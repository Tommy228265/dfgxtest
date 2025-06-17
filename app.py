import os
import re
import json
import uuid
import time
import threading
import logging
import requests
from PyPDF2 import PdfReader
from docx import Document
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("topology_generator.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("KnowledgeGraphGenerator")

# 初始化Flask应用
app = Flask(__name__)
CORS(app)

# 配置上传文件夹
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# OpenAI API配置
OPENAI_API_KEY = "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"
MAX_RETRIES = 3
BACKOFF_FACTOR = 2

def clean_json_string(s: str) -> str:
    """清洗模型输出，去除Markdown代码块标记"""
    s = re.sub(r"```(?:json)?", "", s)
    return s.strip()

def enhance_json_format(json_str: str) -> str:
    """增强JSON格式，处理各种复杂格式问题"""
    import json
    import re
    
    logger.info(f"原始JSON内容: {json_str[:200]}...")
    
    # 1. 移除可能的前导/尾随非JSON字符
    json_str = re.sub(r'^.*?(\[.*\]).*$', r'\1', json_str, flags=re.DOTALL)
    
    # 2. 处理行首缩进和换行
    json_str = re.sub(r'\n\s*', ' ', json_str)
    
    # 3. 处理可能的单引号问题
    json_str = re.sub(r"'", '"', json_str)
    
    # 4. 处理常见的格式错误（尝试修复）
    try:
        # 尝试直接解析
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"初始解析失败: {e}")
        
        # 错误定位
        error_pos = e.pos
        logger.error(f"错误位置: {error_pos}, 附近内容: {json_str[error_pos-20:error_pos+20]}")
        
        # 5. 智能修复常见错误
        # 5.1 处理缺少逗号的情况
        if e.msg == "Expecting ',' delimiter":
            logger.info("尝试修复缺少逗号的问题...")
            json_list = list(json_str)
            
            # 在错误位置前查找可能缺少逗号的位置
            search_start = max(0, error_pos - 100)
            bracket_count = 0
            for i in range(error_pos-1, search_start, -1):
                if json_list[i] == ']':
                    bracket_count += 1
                elif json_list[i] == '[':
                    bracket_count -= 1
                
                # 找到合适的位置插入逗号
                if bracket_count == 0 and json_list[i] == ']':
                    json_list.insert(i+1, ',')
                    logger.info(f"在位置 {i+1} 插入逗号")
                    break
            
            # 尝试再次解析
            try:
                return json.loads(''.join(json_list))
            except json.JSONDecodeError as e2:
                logger.error(f"修复后仍失败: {e2}")
        
        # 5.2 处理未闭合的引号
        if e.msg.startswith('Expecting property name enclosed in double quotes'):
            logger.info("尝试修复未闭合的引号...")
            # 查找最近的未闭合引号并添加
            unclosed_quote_pos = json_str.rfind('"', 0, error_pos)
            if unclosed_quote_pos != -1:
                json_list = list(json_str)
                json_list.insert(error_pos, '"')
                logger.info(f"在位置 {error_pos} 添加引号")
                try:
                    return json.loads(''.join(json_list))
                except json.JSONDecodeError as e3:
                    logger.error(f"修复后仍失败: {e3}")
        
        # 6. 使用更宽松的解析器（作为最后的手段）
        try:
            import ast
            logger.info("尝试使用ast.literal_eval进行宽松解析...")
            parsed = ast.literal_eval(json_str)
            # 转换为标准JSON
            return json.loads(json.dumps(parsed))
        except Exception as e4:
            logger.error(f"宽松解析失败: {e4}")
            logger.error(f"无法修复的JSON内容: {json_str}")
            raise RuntimeError("无法解析API返回的JSON格式") from e4

def sanitize_text(text: str) -> str:
    """清理文本中的特殊字符，防止破坏JSON格式"""
    # 移除可能干扰JSON解析的字符
    text = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', text)  # 移除控制字符
    # 转义特殊字符
    text = text.replace('\\', '\\\\')
    text = text.replace('"', '\\"')
    return text

def extract_knowledge_from_text(text: str, max_retries: int = MAX_RETRIES) -> list:
    """调用OpenAI API提取适合树形结构的知识点层级关系"""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    # 清理文本
    sanitized_text = sanitize_text(text)
    
    messages = [
        {"role": "system", "content": """你是一个知识图谱构建专家，能够从文本中提取知识点并构建树形结构。
请分析文本内容，识别出主要知识点及其层级关系（如父节点-子节点关系），
以JSON数组形式输出，每个元素格式为 [父知识点, 关系, 子知识点]。
关系应体现层级结构，如"包含"、"属于"、"是子类"等。确保输出格式正确，仅返回JSON数组。"""},
        {"role": "user", "content": f"请从下面文本中提取知识点及其层级关系，输出JSON数组，每个元素格式为 [父知识点, 关系, 子知识点]：\n{sanitized_text}"}
    ]
    data = {"model": "gpt-3.5-turbo", "messages": messages, "max_tokens": 1500}
    
    backoff = 2
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"第{attempt}次尝试调用OpenAI API...")
            resp = requests.post(url, headers=headers, json=data, timeout=30)
            resp.raise_for_status()
            
            raw = resp.json()["choices"][0]["message"]["content"]
            cleaned = clean_json_string(raw)
            logger.info(f"API返回知识关系: {cleaned[:200]}...")
            
            # 保存原始响应用于调试
            with open(f"api_response_{time.time()}.txt", "w", encoding="utf-8") as f:
                f.write(cleaned)
            
            # 增强JSON解析
            knowledge_edges = enhance_json_format(cleaned)
            
            # 验证输出格式
            if not isinstance(knowledge_edges, list):
                raise ValueError(f"API返回非数组格式: {type(knowledge_edges)}")
            for idx, item in enumerate(knowledge_edges):
                if not (isinstance(item, list) and len(item) == 3):
                    raise ValueError(f"API返回元素格式错误，应为三元组，位置 {idx}: {item}")
                    
            logger.info(f"成功解析知识关系，共{len(knowledge_edges)}条")
            return knowledge_edges
                
        except requests.exceptions.RequestException as e:
            if isinstance(e, requests.exceptions.HTTPError) and e.response.status_code == 429:
                retry_after = e.response.headers.get("Retry-After", backoff)
                wait = float(retry_after) if retry_after else backoff
                logger.warning(f"[限流] 第{attempt}次重试，等待{wait:.1f}s...")
                time.sleep(wait)
                backoff *= BACKOFF_FACTOR
            else:
                logger.error(f"API请求错误: {str(e)}", exc_info=True)
                raise
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析错误: {e}", exc_info=True)
            if attempt < max_retries:
                logger.info(f"准备第{attempt+1}次重试...")
                time.sleep(backoff)
                backoff *= BACKOFF_FACTOR
            else:
                raise
        except Exception as e:
            logger.error(f"处理知识关系时出错: {str(e)}", exc_info=True)
            if attempt < max_retries:
                logger.info(f"准备第{attempt+1}次重试...")
                time.sleep(backoff)
                backoff *= BACKOFF_FACTOR
            else:
                raise
    
    raise RuntimeError("多次重试后仍无法获取有效响应")

def parse_document(file_path):
    """解析文档内容，返回文本"""
    file_ext = os.path.splitext(file_path)[1].lower()
    logger.info(f"开始解析文档: {file_path}, 类型: {file_ext}")
    
    try:
        if file_ext == '.txt':
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        elif file_ext == '.pdf':
            text = ""
            with open(file_path, 'rb') as file:
                reader = PdfReader(file)
                for page_num, page in enumerate(reader.pages):
                    page_text = page.extract_text() or ""
                    text += page_text
                    if page_num % 10 == 0:
                        logger.info(f"已解析PDF第 {page_num} 页")
            return text
        elif file_ext in ['.docx', '.doc']:
            doc = Document(file_path)
            full_text = []
            for para_num, para in enumerate(doc.paragraphs):
                full_text.append(para.text)
                if para_num % 50 == 0:
                    logger.info(f"已解析Word第 {para_num} 段落")
            return '\n'.join(full_text)
        elif file_ext == '.html':
            with open(file_path, 'r', encoding='utf-8') as file:
                html_content = file.read()
            soup = BeautifulSoup(html_content, 'lxml')
            text = soup.get_text()
            return ' '.join(text.split())
        else:
            logger.error(f"不支持的文件格式: {file_ext}")
            return None
    except Exception as e:
        logger.error(f"解析文档出错: {str(e)}", exc_info=True)
        return None

def build_tree_structure(knowledge_edges):
    """构建树形知识图数据结构，优化可视化效果"""
    nodes = {}
    edges = []
    all_node_ids = set()
    
    # 收集所有节点
    for src, rel, tgt in knowledge_edges:
        all_node_ids.add(src)
        all_node_ids.add(tgt)
        
        # 确保节点存在
        if src not in nodes:
            nodes[src] = {
                "id": src,
                "label": src,
                "title": src,  # 鼠标悬停时显示的完整标题
                "level": 0,    # 默认层级
                "value": 1,    # 节点大小基准
                "group": "default"  # 节点分组，用于着色
            }
        if tgt not in nodes:
            nodes[tgt] = {
                "id": tgt,
                "label": tgt,
                "title": tgt,
                "level": 0,
                "value": 1,
                "group": "default"
            }
        
        # 添加边
        edges.append({
            "from": src,
            "to": tgt,
            "label": rel,
            "title": rel,  # 鼠标悬停时显示的边关系
            "arrows": "to",
            "font": {
                "align": "middle"
            }
        })
    
    # 计算节点层级
    def calculate_level(node_id, current_level=0):
        if node_id in nodes:
            nodes[node_id]["level"] = max(nodes[node_id]["level"], current_level)
            # 递归设置子节点层级
            for edge in edges:
                if edge["from"] == node_id:
                    calculate_level(edge["to"], current_level + 1)
    
    # 找到根节点（没有父节点的节点）
    root_candidates = all_node_ids.copy()
    for _, _, tgt in knowledge_edges:
        root_candidates.discard(tgt)
    
    root = next(iter(root_candidates)) if root_candidates else (list(nodes.keys())[0] if nodes else None)
    
    # 从根节点开始计算层级
    if root:
        calculate_level(root)
    
    # 计算节点重要性（连接数）
    for node_id in nodes:
        in_connections = sum(1 for edge in edges if edge["to"] == node_id)
        out_connections = sum(1 for edge in edges if edge["from"] == node_id)
        nodes[node_id]["value"] = max(1, in_connections + out_connections)
    
    # 转换为节点列表
    tree_nodes = list(nodes.values())
    
    return {
        "nodes": tree_nodes,
        "edges": edges,
        "root": root
    }

def process_document(file_path, topology_id):
    """处理文档并生成树形知识图"""
    start_time = time.time()
    logger.info(f"开始处理文档: {file_path}, 拓扑ID: {topology_id}")
    
    # 更新状态为处理中
    topology_results[topology_id] = {
        "status": "processing",
        "progress": 0,
        "message": "开始处理文档...",
        "created_at": time.strftime('%Y-%m-%d %H:%M:%S')
    }
    
    try:
        # 1. 解析文档
        update_progress(topology_id, 10, "解析文档内容...")
        text = parse_document(file_path)
        if not text:
            topology_results[topology_id] = {
                "status": "error",
                "message": "无法解析文档内容"
            }
            logger.error(f"文档解析失败: {file_path}")
            return
        
        # 2. 检测文本长度
        update_progress(topology_id, 20, "准备提取知识层级...")
        text_length = len(text)
        if text_length < 100:
            topology_results[topology_id] = {
                "status": "error",
                "message": "文档内容过短，无法提取知识"
            }
            logger.warning(f"文档内容过短: {file_path}, 长度: {text_length}")
            return
        
        # 3. 截取文本（限制长度避免API调用超时）
        MAX_TEXT_LENGTH = 8000
        if text_length > MAX_TEXT_LENGTH:
            logger.info(f"文档内容过长，截取前{MAX_TEXT_LENGTH}字符")
            text = text[:MAX_TEXT_LENGTH]
        
        # 4. 调用OpenAI提取知识层级关系
        update_progress(topology_id, 60, "调用OpenAI API提取知识层级...")
        knowledge_edges = extract_knowledge_from_text(text)
        logger.info(f"成功提取{len(knowledge_edges)}条知识层级关系")
        
        # 5. 构建树形知识图
        update_progress(topology_id, 80, "构建树形知识图...")
        knowledge_graph = build_tree_structure(knowledge_edges)
        
        # 6. 完成处理
        processing_time = time.time() - start_time
        logger.info(f"树形知识图生成完成，耗时: {processing_time:.2f} 秒")
        
        update_progress(topology_id, 100, "处理完成")
        time.sleep(1)  # 确保前端有时间获取最终状态
        
        topology_results[topology_id] = {
            "status": "completed",
            "data": knowledge_graph,
            "created_at": time.strftime('%Y-%m-%d %H:%M:%S'),
            "node_count": len(knowledge_graph["nodes"]),
            "edge_count": len(knowledge_graph["edges"]),
            "processing_time": round(processing_time, 2),
            "text_length": text_length
        }
        
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        logger.error(f"处理文档出错: {str(e)}", exc_info=True)
        topology_results[topology_id] = {
            "status": "error",
            "message": f"处理过程中出错: {str(e)}"
        }

def update_progress(topology_id, progress, message):
    """更新处理进度"""
    if topology_id in topology_results:
        topology_results[topology_id].update({
            'progress': progress,
            'message': message
        })
        logger.info(f"拓扑ID: {topology_id}, 进度: {progress}%, 消息: {message}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_document():
    if 'file' not in request.files:
        logger.error("文件上传错误: 没有文件")
        return jsonify({'status': 'error', 'message': '没有文件上传'}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.error("文件上传错误: 未选择文件")
        return jsonify({'status': 'error', 'message': '未选择文件'}), 400
    
    # 检查文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > 50 * 1024 * 1024:  # 50MB限制
        logger.error(f"文件上传错误: 文件过大 ({file_size/1024/1024:.2f} MB)")
        return jsonify({'status': 'error', 'message': '文件大小超过50MB限制'}), 400
    
    topology_id = str(uuid.uuid4())
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{topology_id}_{file.filename}")
    file.save(file_path)
    
    logger.info(f"文件上传成功: {file_path}, 大小: {file_size/1024/1024:.2f} MB")
    
    # 启动处理线程
    threading.Thread(target=process_document, args=(file_path, topology_id)).start()
    
    return jsonify({
        'status': 'success',
        'topology_id': topology_id,
        'message': '文档上传成功，正在生成树形知识图'
    })

@app.route('/api/topology/<topology_id>', methods=['GET'])
def get_topology(topology_id):
    if topology_id not in topology_results:
        logger.error(f"获取拓扑图错误: ID不存在 ({topology_id})")
        return jsonify({'status': 'error', 'message': '拓扑图不存在'}), 404
    
    topology = topology_results[topology_id]
    
    if topology['status'] == 'processing':
        return jsonify({
            'status': 'processing',
            'progress': topology.get('progress', 0),
            'message': topology.get('message', '正在处理中')
        })
    
    if topology['status'] == 'error':
        logger.error(f"获取拓扑图错误: {topology.get('message', '未知错误')}")
        return jsonify({
            'status': 'error',
            'message': topology.get('message', '生成知识图时出错')
        }), 500
    
    return jsonify({
        'status': 'success',
        'data': topology['data'],
        'created_at': topology['created_at'],
        'node_count': topology['node_count'],
        'edge_count': topology['edge_count'],
        'processing_time': topology['processing_time'],
        'text_length': topology.get('text_length', 0)
    })

if __name__ == '__main__':
    # 创建uploads文件夹
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    
    # 拓扑图处理结果存储
    topology_results = {}
    
    logger.info("树形知识图生成系统启动中...")
    app.run(debug=True, port=5000)