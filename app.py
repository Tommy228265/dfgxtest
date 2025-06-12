from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import json
import uuid
import time
import threading
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
import networkx as nx
from flask_cors import CORS

# 加载中文spaCy模型（关键修改点）
nlp = spacy.load('zh_core_web_sm')

app = Flask(__name__)
CORS(app)

# 配置上传文件夹
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 模拟数据库
topology_db = {}

# 中文停用词列表（可扩展）
chinese_stopwords = set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很',
    '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '这个', '这样'
])

# 文档解析函数（添加中文编码处理）
def parse_document(file_path):
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.txt':
            # 尝试多种编码解析中文文档
            for encoding in ['utf-8', 'gbk', 'gb2312']:
                try:
                    with open(file_path, 'r', encoding=encoding) as file:
                        return file.read()
                except:
                    continue
            return None
        elif file_ext in ['.pdf', '.docx', '.doc', '.html']:
            # 实际项目中应使用对应库解析，此处返回模拟文本
            return "这是一个中文文档的内容，用于生成拓扑图。文档中包含一些实体和关系，例如人工智能、机器学习、自然语言处理等技术术语。"
        else:
            return None
    except Exception as e:
        print(f"解析文档出错: {e}")
        return None

# 中文文本预处理函数
def preprocess_text(text):
    if not text:
        return []
    
    doc = nlp(text)
    tokens = [token.lemma_ for token in doc 
              if token.is_alnum() and token.text not in chinese_stopwords and len(token.text) > 1]
    
    return tokens

# 提取中文实体和关系
def extract_entities_and_relations(text):
    doc = nlp(text)
    
    # 提取命名实体
    entities = set()
    for ent in doc.ents:
        entities.add(ent.text)
    
    # 提取关键词作为补充实体
    key_entities = set()
    for token in doc:
        if token.pos_ in ['NOUN', 'PROPN', 'VERB'] and token.text not in chinese_stopwords and len(token.text) > 1:
            key_entities.add(token.lemma_)
    
    entities.update(key_entities)
    entities = list(entities)
    
    # 生成关系
    relations = []
    
    # 1. 基于同一句子的实体共现
    for sent in doc.sents:
        sentence_entities = [ent.text for ent in sent.ents if ent.text in entities]
        if len(sentence_entities) < 2:
            continue
        
        for i in range(len(sentence_entities)):
            for j in range(i+1, len(sentence_entities)):
                relations.append({
                    'source': sentence_entities[i],
                    'target': sentence_entities[j],
                    'type': '共现',
                    'weight': 1.0
                })
    
    # 2. 基于句法依赖的关系
    for token in doc:
        if token.pos_ in ['NOUN', 'PROPN'] and token.text in entities:
            for child in token.children:
                if child.pos_ in ['NOUN', 'PROPN'] and child.text in entities:
                    relations.append({
                        'source': token.text,
                        'target': child.text,
                        'type': child.dep_,
                        'weight': 1.5
                    })
    
    return entities, relations

# 构建拓扑图
def build_topology(entities, relations):
    G = nx.Graph()
    
    for entity in entities:
        G.add_node(entity, label=entity)
    
    for relation in relations:
        G.add_edge(relation['source'], relation['target'], 
                  label=relation['type'], weight=relation['weight'])
    
    nodes = []
    edges = []
    
    centrality = nx.degree_centrality(G)
    betweenness = nx.betweenness_centrality(G)
    
    node_groups = {}
    if entities:
        centrality_values = list(centrality.values())
        avg_centrality = sum(centrality_values) / len(centrality_values)
        high_centrality = avg_centrality * 1.5
        
        for i, entity in enumerate(entities):
            if centrality.get(entity, 0) > high_centrality:
                node_groups[entity] = 'main'
            elif betweenness.get(entity, 0) > 0.1:
                node_groups[entity] = 'bridge'
            else:
                node_groups[entity] = 'associated'
    
    for node in G.nodes():
        nodes.append({
            'id': node,
            'label': node,
            'group': node_groups.get(node, 'associated'),
            'value': (centrality.get(node, 0.1) * 50) + 10
        })
    
    for edge in G.edges(data=True):
        edges.append({
            'from': edge[0],
            'to': edge[1],
            'label': edge[2].get('label', '关联'),
            'width': edge[2].get('weight', 1) * 2
        })
    
    return {
        'nodes': nodes,
        'edges': edges
    }

# 处理文档并生成拓扑图
def process_document(file_path, topology_id):
    start_time = time.time()
    
    try:
        text = parse_document(file_path)
        if not text:
            topology_db[topology_id] = {
                'status': 'error',
                'message': '无法解析文档内容'
            }
            return
        
        tokens = preprocess_text(text)
        if not tokens:
            topology_db[topology_id] = {
                'status': 'error',
                'message': '文档内容为空或无法处理'
            }
            return
        
        entities, relations = extract_entities_and_relations(text)
        
        topology_data = build_topology(entities, relations)
        
        processing_time = time.time() - start_time
        
        topology_db[topology_id] = {
            'status': 'completed',
            'data': topology_data,
            'created_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'node_count': len(topology_data['nodes']),
            'edge_count': len(topology_data['edges']),
            'processing_time': round(processing_time, 2)
        }
        
    except Exception as e:
        print(f"处理文档出错: {e}")
        topology_db[topology_id] = {
            'status': 'error',
            'message': str(e)
        }

# API路由
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_document():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': '没有文件上传'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': '未选择文件'}), 400
    
    topology_id = str(uuid.uuid4())
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{topology_id}_{file.filename}")
    file.save(file_path)
    
    topology_db[topology_id] = {
        'status': 'processing',
        'created_at': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    
    threading.Thread(target=process_document, args=(file_path, topology_id)).start()
    
    return jsonify({
        'status': 'success',
        'topology_id': topology_id,
        'message': '文档上传成功，正在处理中'
    })

@app.route('/api/topology/<topology_id>', methods=['GET'])
def get_topology(topology_id):
    if topology_id not in topology_db:
        return jsonify({'status': 'error', 'message': '拓扑图不存在'}), 404
    
    topology = topology_db[topology_id]
    
    if topology['status'] == 'processing':
        return jsonify({
            'status': 'processing',
            'message': '拓扑图正在生成中'
        })
    
    if topology['status'] == 'error':
        return jsonify({
            'status': 'error',
            'message': topology.get('message', '生成拓扑图时出错')
        }), 500
    
    return jsonify({
        'status': 'success',
        'data': topology['data'],
        'created_at': topology['created_at'],
        'node_count': topology['node_count'],
        'edge_count': topology['edge_count'],
        'processing_time': topology['processing_time']
    })

@app.route('/api/topologies', methods=['GET'])
def get_all_topologies():
    topologies = []
    
    for topology_id, topology in topology_db.items():
        if topology['status'] == 'completed':
            topologies.append({
                'id': topology_id,
                'created_at': topology['created_at'],
                'node_count': topology['node_count'],
                'edge_count': topology['edge_count'],
                'processing_time': topology['processing_time']
            })
    
    return jsonify({
        'status': 'success',
        'count': len(topologies),
        'topologies': topologies
    })

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)