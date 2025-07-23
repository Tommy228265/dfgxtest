import httpx
import os
import json
import uuid
import time
import threading
import logging
import sqlite3
from flask import Flask, request, jsonify, render_template, g
from flask_cors import CORS
from contextlib import closing
from dotenv import load_dotenv
from openai import OpenAI
from openai.types.beta import Assistant
from pydantic import BaseModel, Field
from typing import List, Optional

# --- 步骤 1: 初始化与配置 ---
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("KnowledgeGraphAssistantsApp")
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app, resources={r"/*": {"origins": "*"}})
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("未在.env文件中找到OPENAI_API_KEY环境变量。")
http_client = httpx.Client()

client = OpenAI(
    api_key=OPENAI_API_KEY,
    default_headers={"OpenAI-Beta": "assistants=v2"},
    http_client=http_client
)
DATABASE = os.path.join(app.root_path, 'knowledge_graph.db')
topology_results = {}
quiz_sessions = {}

# --- 步骤 2: 数据库相关函数 ---
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    if os.path.exists(DATABASE):
        logger.info("数据库已存在，跳过初始化。")
        return
    with app.app_context():
        with closing(get_db()) as db:
            schema = """
            CREATE TABLE topologies (id TEXT PRIMARY KEY,content TEXT,max_nodes INTEGER,created_at TEXT,file_id TEXT,assistant_id TEXT,vector_store_id TEXT);
            CREATE TABLE nodes (id TEXT, topology_id TEXT, label TEXT, PRIMARY KEY (topology_id, id));
            CREATE TABLE edges (topology_id TEXT, from_node TEXT, to_node TEXT, label TEXT, PRIMARY KEY (topology_id, from_node, to_node));
            CREATE TABLE questions (id TEXT PRIMARY KEY, topology_id TEXT, node_id TEXT, question TEXT, answer TEXT, feedback TEXT, correctness INTEGER, created_at TEXT, answered_at TEXT);
            """
            db.cursor().executescript(schema)
            db.commit()
            logger.info("数据库初始化成功。")

# --- 步骤 3: 辅助工具函数 ---
def clean_json_string(s: str) -> str:
    # 修正：现在需要提取JSON对象，所以查找第一个'{'和最后一个'}'
    start_index = s.find('{')
    end_index = s.rfind('}')
    if start_index != -1 and end_index != -1 and end_index > start_index:
        return s[start_index : end_index + 1].strip()
    return s

def update_progress(topology_id, progress, message):
    if topology_id in topology_results:
        topology_results[topology_id].update({'progress': progress, 'message': message})
        logger.info(f"进度更新 {topology_id}: {progress}% - {message}")

def with_app_context(func, *args, **kwargs):
    with app.app_context():
        func(*args, **kwargs)

# --- 步骤 4: 核心AI交互逻辑 ---
def _run_assistant_and_wait(assistant_id: str, thread_id: str) -> str:
    try:
        run = client.beta.threads.runs.create_and_poll(
            thread_id=thread_id,
            assistant_id=assistant_id
        )
        if run.status == 'completed':
            messages = client.beta.threads.messages.list(thread_id=thread_id)
            if messages.data:
                latest_message = messages.data[0]
                if latest_message.content:
                    message_content = latest_message.content[0].text
                    annotations = message_content.annotations
                    text_value = message_content.value
                    if annotations:
                        for annotation in annotations:
                            text_value = text_value.replace(annotation.text, '')
                    return text_value.strip()
            return ""
        else:
            raise RuntimeError(f"助手运行失败，最终状态: {run.status}, 原因: {run.last_error}")
    except Exception as e:
        logger.error(f"运行助手时出错 (Assistant ID: {assistant_id}, Thread ID: {thread_id}): {e}", exc_info=True)
        raise

def _create_graph_assistant(vector_store_id: str, topology_id: str, max_nodes: int) -> Assistant:
    # 【MODIFIED】: 全新Prompt，指导AI自行完成从“三元组思考”到“nodes/edges输出”的转换
    instructions = """你是顶级的知识图谱构建专家。

### **思考过程 (你的内心活动)**
1.  **识别三元组**: 你的首要任务是深入分析文档，识别出其中所有具备层级关系的知识点，并将它们构造成 `[父知识点, 关系, 子知识点]` 格式的三元组。关系词应选择如“包含”、“组成部分是”、“负责”等。
2.  **去重与整合**: 在脑海中形成一个所有三元组的列表。

### **最终输出格式 (你必须严格遵守)**
你的最终输出**绝对不能**是三元组列表！你必须将你思考得出的三元组，转换成一个**单一的、严格的JSON对象**，该对象包含 `nodes` 和 `edges` 两个键。

-   `"nodes"`: 一个对象数组。
    -   遍历你识别出的所有知识点（父节点和子节点），为每一个**不重复**的知识点创建一个节点对象。
    -   每个节点对象格式为 `{"id": "知识点名称", "label": "知识点名称"}`。`id` 和 `label` 必须相同。
-   `"edges"`: 一个对象数组。
    -   遍历你识别出的每一个三元组 `[父, 关系, 子]`。
    -   为每个三元组创建一个边对象，格式为 `{"from": "父知识点ID", "to": "子知识点ID", "label": "关系"}`。

### **示例**
-   **如果你的思考结果是**: `[["AI", "包含", "机器学习"], ["机器学习", "是一种", "算法"]]`
-   **那么你的最终输出必须是**:
    ```json
    {
      "nodes": [
        {"id": "AI", "label": "AI"},
        {"id": "机器学习", "label": "机器学习"},
        {"id": "算法", "label": "算法"}
      ],
      "edges": [
        {"from": "AI", "to": "机器学习", "label": "包含"},
        {"from": "机器学习", "to": "算法", "label": "是一种"}
      ]
    }
    ```

### **其他规则**
- **语言**: 所有 `label` 都必须是**中文**。
- **来源**: 所有内容必须严格来自文件。
"""
    return client.beta.assistants.create(
        name=f"GraphGen-{topology_id}",
        instructions=instructions,
        model="gpt-4-turbo",
        tools=[{"type": "file_search"}],
        tool_resources={"file_search": {"vector_store_ids": [vector_store_id]}}
    )

# --- 步骤 5: 主要的后台处理函数 ---
def process_document(file_path, topology_id, max_nodes=0):
    start_time = time.time()
    topology_results[topology_id] = {"status": "processing", "progress": 0, "message": "任务开始..."}
    try:
        with app.app_context():
            update_progress(topology_id, 10, "正在创建向量存储并上传文件...")
            vector_store = client.beta.vector_stores.create(name=f"GraphGenStore-{topology_id}")
            
            with open(file_path, "rb") as f:
                file_object = client.files.create(file=f, purpose="assistants")
            
            client.beta.vector_stores.files.create_and_poll(vector_store_id=vector_store.id, file_id=file_object.id)
            file_id = file_object.id

            update_progress(topology_id, 25, "正在创建AI助手...")
            assistant = _create_graph_assistant(vector_store.id, topology_id, max_nodes)
            
            update_progress(topology_id, 50, "正在生成知识图谱...")
            thread = client.beta.threads.create()
            client.beta.threads.messages.create(thread_id=thread.id, role="user", content="请根据你的指令，分析文件并生成知识图谱的JSON对象。")
            
            json_response = _run_assistant_and_wait(assistant.id, thread.id)
            logger.info(f"收到的来自AI的原始响应: '{json_response}'")
            
            try:
                cleaned_json = clean_json_string(json_response)
                # 【MODIFIED】: 直接解析为最终格式，不再需要本地转换
                knowledge_graph_data = json.loads(cleaned_json)
                if not isinstance(knowledge_graph_data, dict) or "nodes" not in knowledge_graph_data or "edges" not in knowledge_graph_data:
                    raise ValueError("AI返回的不是一个有效的nodes/edges JSON对象。")
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"解析AI响应时失败: '{cleaned_json}'", exc_info=True)
                raise ValueError("AI助手返回了无法解析的JSON内容。") from e

            update_progress(topology_id, 90, "正在保存至数据库...")
            db = get_db()
            cursor = db.cursor()
            cursor.execute("INSERT INTO topologies (id, max_nodes, created_at, file_id, assistant_id, vector_store_id) VALUES (?, ?, ?, ?, ?, ?)", (topology_id, max_nodes, time.strftime('%Y-%m-%d %H:%M:%S'), file_id, assistant.id, vector_store.id))
            
            nodes_to_save = knowledge_graph_data.get('nodes', [])
            edges_to_save = knowledge_graph_data.get('edges', [])
            for node in nodes_to_save:
                cursor.execute("INSERT INTO nodes (topology_id, id, label) VALUES (?, ?, ?)", (topology_id, node.get('id'), node.get('label')))
            for edge in edges_to_save:
                cursor.execute("INSERT INTO edges (topology_id, from_node, to_node, label) VALUES (?, ?, ?, ?)", (topology_id, edge.get('from'), edge.get('to'), edge.get('label')))
            db.commit()

            update_progress(topology_id, 100, "处理完成")
            topology_results[topology_id] = {"status": "success", "data": knowledge_graph_data, "node_count": len(nodes_to_save), "edge_count": len(edges_to_save), "processing_time": round(time.time() - start_time, 2)}
    except Exception as e:
        logger.error(f"处理文档 {topology_id} 时出错: {e}", exc_info=True)
        topology_results[topology_id] = {"status": "error", "message": str(e)}

# --- 步骤 6: Flask API 接口定义 ---

@app.route('/')
def index():
    return render_template('index.html')

# ... 其他路由保持不变 ...
@app.route('/api/generate', methods=['POST'])
def generate_knowledge_graph_route():
    if 'file' not in request.files: return jsonify({'status': 'error', 'message': '没有文件部分'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'status': 'error', 'message': '未选择文件'}), 400
    
    topology_id = str(uuid.uuid4())
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{topology_id}_{file.filename}")
    file.save(file_path)
    
    max_nodes = request.form.get('max_nodes', 0, type=int)
    threading.Thread(target=with_app_context, args=(process_document, file_path, topology_id, max_nodes)).start()
    
    return jsonify({'status': 'success', 'topology_id': topology_id})

@app.route('/api/topology/<topology_id>', methods=['GET'])
def get_topology_route(topology_id):
    if topology_id in topology_results:
        result = topology_results[topology_id]
        if result.get("status") == "completed":
            result["status"] = "success"
        return jsonify(result)
    
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        if not cursor.execute("SELECT id FROM topologies WHERE id=?", (topology_id,)).fetchone():
            return jsonify({'status': 'error', 'message': '未找到该拓扑图'}), 404
        
        nodes_query = cursor.execute("SELECT id, label FROM nodes WHERE topology_id=?", (topology_id,)).fetchall()
        edges_query = cursor.execute("SELECT from_node as 'from', to_node as 'to', label FROM edges WHERE topology_id=?", (topology_id,)).fetchall()
        
        nodes = [dict(row) for row in nodes_query]
        edges = [dict(row) for row in edges_query]

        for node in nodes:
            node['mastered'] = False
            node['mastery_score'] = 0
            node['consecutive_correct'] = 0
        
        return jsonify({
            'status': 'success', 
            'data': {'nodes': nodes, 'edges': edges},
            'node_count': len(nodes),
            'edge_count': len(edges)
        })

@app.route('/api/topology/<topology_id>/regenerate', methods=['POST'])
def regenerate_topology_route(topology_id):
    max_nodes = request.json.get('max_nodes', 0)
    
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        topo_info = cursor.execute("SELECT vector_store_id FROM topologies WHERE id=?", (topology_id,)).fetchone()
        if not topo_info: return jsonify({'status': 'error', 'message': '未找到该拓扑图'}), 404
        vector_store_id = topo_info['vector_store_id']

    try:
        new_assistant = _create_graph_assistant(vector_store_id, topology_id, max_nodes)
        
        thread = client.beta.threads.create()
        client.beta.threads.messages.create(thread_id=thread.id, role="user", content="请根据你的新指令，重新生成知识图谱JSON。")
        json_response = _run_assistant_and_wait(new_assistant.id, thread.id)
        
        # 直接解析，无需转换
        new_graph_data = json.loads(clean_json_string(json_response))
        
        with app.app_context():
            db = get_db()
            cursor = db.cursor()
            cursor.execute("DELETE FROM nodes WHERE topology_id=?", (topology_id,))
            cursor.execute("DELETE FROM edges WHERE topology_id=?", (topology_id,))
            
            nodes_to_save = new_graph_data.get('nodes', [])
            edges_to_save = new_graph_data.get('edges', [])

            for node in nodes_to_save:
                cursor.execute("INSERT INTO nodes (topology_id, id, label) VALUES (?, ?, ?)", (topology_id, node.get('id'), node.get('label')))
            for edge in edges_to_save:
                cursor.execute("INSERT INTO edges (topology_id, from_node, to_node, label) VALUES (?, ?, ?, ?)", (topology_id, edge.get('from'), edge.get('to'), edge.get('label')))

            cursor.execute("UPDATE topologies SET assistant_id=?, max_nodes=? WHERE id=?", (new_assistant.id, max_nodes, topology_id))
            db.commit()
        
        return jsonify({'status': 'success', 'message': '图谱已成功重新生成。', 'data': new_graph_data, 'node_count': len(nodes_to_save), 'edge_count': len(edges_to_save)})

    except Exception as e:
        logger.error(f"重新生成图谱 {topology_id} 时出错: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500


def _generate_question_for_node(assistant_id: str, node_id: str) -> str:
    thread = client.beta.threads.create()
    client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=f"""
        **重要指令**：
        你的最高优先级任务是为知识点 **"{node_id}"** 生成一个问题。
        1.  请在文档中找到与 **"{node_id}"** 最直接相关的内容。
        2.  **只能**根据这部分内容生成一个简明扼要的测验问题。
        3.  如果检索到的其他信息与 **"{node_id}"** 无关，必须忽略它们。
        4.  问题中不要包含任何答案或提示。
        """
    )
    return _run_assistant_and_wait(assistant_id, thread.id)

@app.route('/api/topology/<topology_id>/node/<node_id>/question', methods=['GET'])
def get_question_route(topology_id, node_id):
    session_id = request.args.get('session_id')
    
    with app.app_context():
        topo_info = get_db().cursor().execute("SELECT assistant_id FROM topologies WHERE id=?", (topology_id,)).fetchone()
        if not topo_info: return jsonify({'status': 'error', 'message': '未找到该拓扑图'}), 404
    
    assistant_id = topo_info['assistant_id']

    if not session_id:
        session_id = str(uuid.uuid4())
        quiz_sessions[session_id] = {"node_id": node_id, "consecutive_correct": 0, "mastered": False}
        logger.info(f"为节点 {node_id} 创建新问答会话: {session_id}")
    
    session = quiz_sessions.get(session_id)
    if not session or session.get("node_id") != node_id:
        return jsonify({'status': 'error', 'message': '会话无效或节点不匹配'}), 400

    if session.get("mastered"):
        logger.info(f"节点 {node_id} 在会话 {session_id} 中已掌握。")
        return jsonify({'status': 'success', 'mastered': True})

    try:
        question_text = _generate_question_for_node(assistant_id, node_id)
        question_id = str(uuid.uuid4())
        
        with app.app_context():
            db = get_db()
            db.cursor().execute("INSERT INTO questions (id, topology_id, node_id, question, created_at) VALUES (?, ?, ?, ?, ?)", (question_id, topology_id, node_id, question_text, time.strftime('%Y-%m-%d %H:%M:%S')))
            db.commit()

        response_data = {"question_id": question_id, "question": question_text, "session_id": session_id}
        return jsonify({'status': 'success', 'data': response_data, 'mastered': False})
        
    except Exception as e:
        logger.error(f"为节点 {node_id} 获取问题时出错: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500


class AnswerEvaluation(BaseModel):
    correct: bool = Field(description="用户的回答是否正确。")
    feedback: str = Field(description="对用户的回答进行评价，解释为什么正确或错误。")
    correct_answer_from_document: str = Field(description="直接从文档中提取的、能够完整回答问题的原文段落，作为标准参考答案。")


@app.route('/api/topology/<topology_id>/question/<question_id>/answer', methods=['POST'])
def answer_question_route(topology_id, question_id):
    data = request.json
    user_answer = data.get('answer')
    session_id = data.get('session_id')
    node_id = data.get('node_id')

    if not all([user_answer, session_id, node_id]):
        return jsonify({'status': 'error', 'message': '缺少必要参数 (answer, session_id, node_id)'}), 400

    session = quiz_sessions.get(session_id)
    if not session or session.get("node_id") != node_id:
        return jsonify({'status': 'error', 'message': '会话ID无效或与节点不匹配'}), 400

    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        q_info = cursor.execute("SELECT question FROM questions WHERE id=?", (question_id,)).fetchone()
        topo_info = cursor.execute("SELECT assistant_id FROM topologies WHERE id=?", (topology_id,)).fetchone()
        if not q_info or not topo_info:
            return jsonify({'status': 'error', 'message': '问题或拓扑图未找到'}), 404

    try:
        schema = AnswerEvaluation.model_json_schema()
        
        eval_response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "你是一位专业的助教。你的任务是：1. 评估学生对问题的回答是否正确。2. 给出评价。3. 最重要的是，从你关联的文档中，找出并提供这个问题的标准答案原文。"},
                {"role": "user", "content": f"问题是：“{q_info['question']}”。学生的回答是：“{user_answer}”。请根据文件内容，完成评估和提取标准答案的任务。"}
            ],
            tools=[{"type": "function", "function": {"name": "evaluate_answer", "parameters": schema}}],
            tool_choice={"type": "function", "function": {"name": "evaluate_answer"}}
        )
        tool_call = eval_response.choices[0].message.tool_calls[0]
        eval_data = json.loads(tool_call.function.arguments)
        is_correct = eval_data.get('correct', False)

        if is_correct:
            session["consecutive_correct"] += 1
        else:
            session["consecutive_correct"] = 0
        
        if session["consecutive_correct"] >= 3:
            session["mastered"] = True
        
        quiz_sessions[session_id] = session
        
        next_question_data = None
        if not session["mastered"]:
            try:
                next_q_text = _generate_question_for_node(topo_info['assistant_id'], node_id)
                next_q_id = str(uuid.uuid4())
                next_question_data = {"id": next_q_id, "question": next_q_text}
                with app.app_context():
                    db = get_db()
                    db.cursor().execute("INSERT INTO questions (id, topology_id, node_id, question, created_at) VALUES (?, ?, ?, ?, ?)", (next_q_id, topology_id, node_id, next_q_text, time.strftime('%Y-%m-%d %H:%M:%S')))
                    db.commit()
            except Exception as e:
                logger.error(f"为会话 {session_id} 生成下一个问题时失败: {e}")
        
        final_feedback = eval_data.get('feedback', '')
        correct_answer = eval_data.get('correct_answer_from_document', '')
        if correct_answer:
            final_feedback += f"\n\n**参考答案：**\n{correct_answer}"

        with app.app_context():
            db = get_db()
            db.cursor().execute("UPDATE questions SET answer=?, feedback=?, correctness=?, answered_at=? WHERE id=?", (user_answer, final_feedback, int(is_correct), time.strftime('%Y-%m-%d %H:%M:%S'), question_id))
            db.commit()

        response_data = {"correct": is_correct, "feedback": final_feedback, "consecutive_correct": session["consecutive_correct"], "mastered": session["mastered"], "next_question": next_question_data}
        return jsonify({'status': 'success', 'data': response_data})

    except Exception as e:
        logger.error(f"评估问题 {question_id} 的答案时出错: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ... 其余部分保持不变 ...
@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

if __name__ == '__main__':
    init_db()
    logger.info("知识图谱生成系统启动中...")
    app.run(debug=True, port=5000)