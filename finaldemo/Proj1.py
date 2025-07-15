import os
import re
import requests
import time
import json
from pyvis.network import Network

# 清洗模型输出，去除 Markdown 代码块标记

def clean_json_string(s: str) -> str:
    s = re.sub(r"```(?:json)?", "", s)
    return s.strip()

#调用大模型提取知识点-关系三元组，带重试和清洗

def extract_knowledge_from_text(text: str, openai_api_key: str, max_retries: int = 5) -> list:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {openai_api_key}"
    }
    messages = [
        {"role": "system", "content": "你是一个知识提取助手，能从文本中抽取‘知识点-关系-知识点’三元组，并以 JSON 数组输出。"},
        {"role": "user", "content": f"请从下面文本中提取知识点及它们的关系，输出 JSON 数组，每个元素格式为 [源, 关系, 目标]：\n{text}"}
    ]
    data = {"model": "gpt-3.5-turbo", "messages": messages}

    backoff = 5
    for attempt in range(1, max_retries + 1):
        resp = requests.post(url, headers=headers, json=data)
        if resp.status_code == 200:
            raw = resp.json()["choices"][0]["message"]["content"]
            cleaned = clean_json_string(raw)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                raise ValueError(f"无法解析模型输出为 JSON:\n{cleaned}")
        elif resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            wait = float(retry_after) if retry_after else backoff
            print(f"[限流] 第{attempt}次重试，等待{wait:.1f}s...")
            time.sleep(wait)
            backoff *= 2
        else:
            resp.raise_for_status()
    raise RuntimeError("多次重试后仍然收到 429，放弃请求。")

# 2 生成交互式知识图并写入 HTML

def generate_knowledge_graph(knowledge_edges: list, highlight_edges: list = None, output_html: str = "knowledge_graph.html") -> None:
    """
    利用 pyvis 绘制知识图并写入 HTML 文件，不在 notebook 模式。
    highlight_edges 是一组 (源, 目标) 的元组，将以红色标记。
    """
    net = Network(height="600px", width="100%", directed=True)
    for src, rel, tgt in knowledge_edges:
        net.add_node(src, label=src)
        net.add_node(tgt, label=tgt)
        color = "red" if highlight_edges and (src, tgt) in highlight_edges else "gray"
        net.add_edge(src, tgt, label=rel, color=color)
    net.write_html(output_html)
    print(f"交互式知识图已保存至 {output_html}")

# 3 生成问答对，带重试和清洗

def generate_qa_pairs(knowledge_text: str, openai_api_key: str, max_retries: int = 5) -> list:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {openai_api_key}"
    }
    messages = [
        {"role": "system", "content": "你是一个问答生成助手，能基于知识点生成问答对，并以 JSON 数组输出，每项含 question 和 answer 字段。"},
        {"role": "user", "content": f"请基于以下知识点，生成3个问答对，输出 JSON 数组，每个元素格式：{{\"question\":...,\"answer\":...}}：\n{knowledge_text}"}
    ]
    data = {"model": "gpt-3.5-turbo", "messages": messages}

    backoff = 5
    for attempt in range(1, max_retries + 1):
        resp = requests.post(url, headers=headers, json=data)
        if resp.status_code == 200:
            raw = resp.json()["choices"][0]["message"]["content"]
            cleaned = clean_json_string(raw)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                raise ValueError(f"无法解析问答生成结果为 JSON:\n{cleaned}")
        elif resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            wait = float(retry_after) if retry_after else backoff
            print(f"[限流] 第{attempt}次重试，等待{wait:.1f}s...")
            time.sleep(wait)
            backoff *= 2
        else:
            resp.raise_for_status()
    raise RuntimeError("多次重试后仍然收到 429，放弃请求。")

# 主流程示例
if __name__ == "__main__":
    doc_text = (
        "经济学原理主要包括供给与需求、价格弹性、边际效用等基本概念。"
        "供给与需求决定价格水平；边际效用影响消费者选择。"
    )
    api_key = os.getenv("OPENAI_API_KEY") or "sk-你的密钥"

    edges = extract_knowledge_from_text(doc_text, api_key)
    print("抽取的知识图 edges:", edges)

    wrong = [("供给与需求", "价格弹性")]
    generate_knowledge_graph(edges, highlight_edges=wrong)

    qa_list = generate_qa_pairs(doc_text, api_key)
    print("生成的问答对:")
    for qa in qa_list:
        print(f"Q: {qa['question']}\nA: {qa['answer']}\n")
