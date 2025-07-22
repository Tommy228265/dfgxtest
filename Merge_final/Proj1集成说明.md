# Proj1.py 功能集成说明

## 概述

`Proj1.py` 是一个独立的知识图谱处理脚本，包含以下核心功能：
1. **知识提取**：从文本中提取知识点-关系三元组
2. **知识图谱生成**：使用 pyvis 生成交互式知识图谱
3. **问答对生成**：基于知识点生成练习问答对

## 集成状态

### ✅ 已集成的功能

1. **问答对生成功能**
   - 函数：`generate_qa_pairs_from_knowledge()`
   - API接口：`/api/topology/<topology_id>/generate_qa`
   - 功能：基于上传文档内容生成问答对，用于学习练习

2. **错误处理机制**
   - 重试机制：API调用失败时自动重试
   - 错误清洗：清理和修复JSON格式问题
   - 日志记录：详细的错误和调试信息

### 🔄 可选择性集成的功能

1. **pyvis 知识图谱可视化**
   - 需要安装：`pip install pyvis`
   - 功能：生成交互式HTML知识图谱
   - 集成方式：可以作为可选的导出功能

2. **独立的知识提取功能**
   - 当前项目已有类似功能，但可以借鉴其错误处理机制

## 使用方法

### 1. 问答对生成

```python
# 调用API生成问答对
POST /api/topology/{topology_id}/generate_qa

# 响应格式
{
    "status": "success",
    "qa_pairs": [
        {
            "question": "什么是供给与需求？",
            "answer": "供给与需求是经济学的基本概念..."
        },
        ...
    ],
    "count": 3
}
```

### 2. pyvis 可视化（可选）

```python
from pyvis.network import Network

# 创建知识图谱
net = Network(height="600px", width="100%", directed=True)

# 添加节点和边
for src, rel, tgt in knowledge_edges:
    net.add_node(src, label=src)
    net.add_node(tgt, label=tgt)
    net.add_edge(src, tgt, label=rel, color="gray")

# 保存为HTML
net.write_html("knowledge_graph.html")
```

## 测试

运行测试文件验证集成功能：

```bash
python test_integration.py
```

## 依赖项

### 必需依赖
- 已包含在现有项目中

### 可选依赖
```bash
pip install pyvis  # 用于交互式知识图谱可视化
```

## 优势

1. **增强学习体验**：问答对生成功能提供练习机会
2. **更好的错误处理**：借鉴了Proj1.py的健壮错误处理机制
3. **模块化设计**：功能可以独立使用，不影响现有系统

## 注意事项

1. **API密钥**：确保DeepSeek API密钥配置正确
2. **性能考虑**：问答对生成可能需要较长时间，建议异步处理
3. **存储空间**：生成的HTML文件可能较大，注意磁盘空间

## 未来扩展

1. **批量问答对生成**：支持批量生成多个知识点的问答对
2. **问答对难度分级**：根据用户掌握程度调整问题难度
3. **可视化增强**：集成更多交互式图表功能 