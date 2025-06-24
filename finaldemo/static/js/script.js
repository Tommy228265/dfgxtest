// 全局变量
let network = null;
let currentTopologyId = null;
let selectedNodeId = null;
let currentQuestionId = null;
let topologyResults = {};
let selectedFile = null;
let maxNodes = 0;

// DOM元素
const fileInput = document.getElementById('fileInput');
const uploadContainer = document.getElementById('uploadContainer');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressPercentage = document.getElementById('progressPercentage');
const progressMessage = document.getElementById('progressMessage');
const graphContainer = document.getElementById('graphContainer');
const networkContainer = document.getElementById('networkContainer');
const nodeCount = document.getElementById('nodeCount');
const edgeCount = document.getElementById('edgeCount');
const quizContainer = document.getElementById('quizContainer');
const questionCard = document.getElementById('questionCard');
const answerFeedback = document.getElementById('answerFeedback');
const noQuestion = document.getElementById('noQuestion');
const currentQuestion = document.getElementById('currentQuestion');
const userAnswer = document.getElementById('userAnswer');
const submitAnswer = document.getElementById('submitAnswer');
const feedbackTitle = document.getElementById('feedbackTitle');
const feedbackText = document.getElementById('feedbackText');
const feedbackCard = document.getElementById('feedbackCard');
const nextQuestion = document.getElementById('nextQuestion');
const searchNode = document.getElementById('searchNode');
const refreshGraph = document.getElementById('refreshGraph');
const generateBtn = document.getElementById('generateBtn');

// 新增DOM元素
const fileStatus = document.getElementById('fileStatus');
const fileNameDisplay = document.getElementById('fileNameDisplay');

// 文件选择事件
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    
    // 显示文件状态
    fileNameDisplay.textContent = selectedFile.name;
    fileStatus.classList.remove('hidden');
    
    // 添加按钮动画效果
    generateBtn.classList.add('pulse');
    
    // 添加上传区域高亮效果
    document.querySelector('.upload-area').classList.add('file-selected');
    
    // 显示通知
    showNotification('文件已上传', `${selectedFile.name} 准备就绪，点击"开始生成"按钮`, 'success');
  } else {
    // 如果没有选择文件，重置状态
    fileStatus.classList.add('hidden');
    generateBtn.classList.remove('pulse');
    document.querySelector('.upload-area').classList.remove('file-selected');
  }
});

// 开始生成按钮事件
generateBtn.addEventListener('click', () => {
  if (!selectedFile) {
    showNotification('错误', '请先选择文件', 'error');
    return;
  }
  
  // 获取节点数量
  maxNodes = document.getElementById('nodeCountInput').value ? 
             parseInt(document.getElementById('nodeCountInput').value) : 0;
  
  // 显示进度区域
  progressContainer.classList.remove('hidden');
  graphContainer.classList.add('hidden');
  quizContainer.classList.add('hidden');
  
  // 重置进度
  progressBar.style.width = '0%';
  progressPercentage.textContent = '0%';
  progressMessage.textContent = '准备处理文档...';
  
  // 移除按钮动画
  generateBtn.classList.remove('pulse');
  
  // 隐藏文件状态提示
  fileStatus.classList.add('hidden');
  
  // 移除上传区域高亮
  document.querySelector('.upload-area').classList.remove('file-selected');
  
  // 调用新的API开始生成
  startGeneration(selectedFile, maxNodes);
});

// 新的API调用函数
function startGeneration(file, maxNodes) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('max_nodes', maxNodes);
  
  fetch('/api/generate', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      currentTopologyId = data.topology_id;
      monitorProgress(currentTopologyId);
    } else {
      showNotification('错误', data.message, 'error');
      resetUpload();
    }
  })
  .catch(error => {
    console.error('生成请求错误:', error);
    showNotification('错误', '请求过程中发生错误，请重试。', 'error');
    resetUpload();
  });
}

// 上传文档（保留原有函数，可能在其他地方使用）
function uploadDocument(file) {
  // 验证文件类型
  const allowedTypes = [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  const allowedExtensions = ['.ppt', '.pptx', '.pdf', '.docx', '.doc', '.txt'];
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
    showNotification('错误', '不支持的文件类型，请上传PPT、PDF、Word或TXT文件。', 'error');
    return;
  }
  
  // 验证文件大小
  if (file.size > 50 * 1024 * 1024) {
    showNotification('错误', '文件大小超过50MB限制。', 'error');
    return;
  }
  
  // 显示进度区域
  progressContainer.classList.remove('hidden');
  graphContainer.classList.add('hidden');
  quizContainer.classList.add('hidden');
  
  // 重置进度
  progressBar.style.width = '0%';
  progressPercentage.textContent = '0%';
  progressMessage.textContent = '准备上传文档...';
  
  // 创建表单数据
  const formData = new FormData();
  formData.append('file', file);
  
  // 发送请求
  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      currentTopologyId = data.topology_id;
      monitorProgress(currentTopologyId);
    } else {
      showNotification('错误', data.message, 'error');
      resetUpload();
    }
  })
  .catch(error => {
    console.error('上传错误:', error);
    showNotification('错误', '上传过程中发生错误，请重试。', 'error');
    resetUpload();
  });
}

// 监控处理进度
function monitorProgress(topology_id) {
  const interval = setInterval(() => {
    fetch(`/api/topology/${topology_id}`)
      .then(response => response.json())
      .then(data => {
        if (data.status === 'processing') {
          const progress = data.progress || 0;
          progressBar.style.width = `${progress}%`;
          progressPercentage.textContent = `${progress}%`;
          progressMessage.textContent = data.message || '处理中...';
        } else if (data.status === 'success') {
          clearInterval(interval);
          renderGraph(data.data);
          nodeCount.textContent = data.node_count;
          edgeCount.textContent = data.edge_count;
          progressContainer.classList.add('hidden');
          graphContainer.classList.remove('hidden');
          quizContainer.classList.remove('hidden');
          noQuestion.classList.remove('hidden');
          questionCard.classList.add('hidden');
          answerFeedback.classList.add('hidden');
        } else if (data.status === 'error') {
          clearInterval(interval);
          showNotification('错误', data.message, 'error');
          resetUpload();
        }
      })
      .catch(error => {
        console.error('获取进度错误:', error);
        clearInterval(interval);
        showNotification('错误', '获取处理进度时发生错误，请重试。', 'error');
        resetUpload();
      });
  }, 1000);
}

// 渲染知识图谱
function renderGraph(graphData) {
  // 销毁现有网络
  if (network !== null) {
    network.destroy();
  }
  
  // 创建节点和边
  const nodes = new vis.DataSet(graphData.nodes);
  const edges = new vis.DataSet(graphData.edges);
  
  // 设置节点样式
  nodes.update(graphData.nodes.map(node => {
    const style = {
      shape: 'circle',
      size: Math.max(10, node.value * 2),
      font: {
        color: '#ffffff',
        size: 14,
        face: 'Inter'
      }
    };
    
    // 根据掌握程度设置颜色
    if (node.mastered) {
      style.color = {
        border: '#2ecc71',
        background: '#2ecc71',
        highlight: {
          border: '#27ae60',
          background: '#27ae60'
        }
      };
    } else if (node.mastery_score > 0) {
      style.color = {
        border: '#f39c12',
        background: '#f39c12',
        highlight: {
          border: '#d35400',
          background: '#d35400'
        }
      };
    } else {
      style.color = {
        border: '#e74c3c',
        background: '#e74c3c',
        highlight: {
          border: '#c0392b',
          background: '#c0392b'
        }
      };
    }
    
    return {
      ...node,
      ...style
    };
  }));
  
  // 数据
  const data = {
    nodes: nodes,
    edges: edges
  };
  
  // 配置选项
  const options = {
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD',
        sortMethod: 'directed',
        nodeSpacing: 150,
        levelSeparation: 200
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200
    },
    physics: {
      enabled: false
    },
    nodes: {
      shape: 'circle',
      font: {
        size: 14,
        face: 'Inter'
      }
    },
    edges: {
      color: {
        color: '#95a5a6',
        highlight: '#7f8c8d'
      },
      width: 1,
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.8
        }
      },
      font: {
        size: 12,
        face: 'Inter',
        align: 'middle'
      }
    }
  };
  
  // 创建网络
  network = new vis.Network(networkContainer, data, options);
  
  // 节点点击事件
  network.on('click', function(params) {
    if (params.nodes.length > 0) {
      selectedNodeId = params.nodes[0];
      getQuestion(selectedNodeId);
    }
  });
  
  // 节点悬停事件
  network.on('hoverNode', function(params) {
    const node = nodes.get(params.node);
    network.setOptions({
      nodes: {
        title: `<div class="tooltip"><b>${node.label}</b><br>掌握程度: ${node.mastery_score || 0}/10</div>`
      }
    });
  });
  
  // 搜索节点
  searchNode.addEventListener('input', function() {
    const query = this.value.toLowerCase().trim();
    if (query === '') {
      nodes.update(nodes.get().map(node => ({
        ...node,
        color: {
          ...node.color,
          background: node.color.background,
          border: node.color.border
        }
      })));
      return;
    }
    
    // 高亮匹配的节点
    nodes.update(nodes.get().map(node => {
      if (node.label.toLowerCase().includes(query)) {
        return {
          ...node,
          color: {
            ...node.color,
            background: '#3498db',
            border: '#2980b9'
          }
        };
      }
      return node;
    }));
  });
  
  // 刷新图谱
  refreshGraph.addEventListener('click', function() {
    fetch(`/api/topology/${currentTopologyId}`)
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          renderGraph(data.data);
          nodeCount.textContent = data.node_count;
          edgeCount.textContent = data.edge_count;
        }
      })
      .catch(error => {
        console.error('刷新图谱错误:', error);
        showNotification('错误', '刷新图谱时发生错误，请重试。', 'error');
      });
  });
}

// 获取问题
function getQuestion(nodeId) {
  if (!currentTopologyId || !nodeId) return;
  
  noQuestion.classList.add('hidden');
  questionCard.classList.remove('hidden');
  answerFeedback.classList.add('hidden');
  
  fetch(`/api/topology/${currentTopologyId}/node/${nodeId}/question`)
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        currentQuestion.textContent = data.data.question;
        currentQuestionId = data.data.question_id;
        userAnswer.value = '';
        userAnswer.focus();
      } else {
        showNotification('错误', data.message, 'error');
        noQuestion.classList.remove('hidden');
        questionCard.classList.add('hidden');
      }
    })
    .catch(error => {
      console.error('获取问题错误:', error);
      showNotification('错误', '获取问题时发生错误，请重试。', 'error');
      noQuestion.classList.remove('hidden');
      questionCard.classList.add('hidden');
    });
}

// 提交答案
submitAnswer.addEventListener('click', function() {
  if (!currentTopologyId || !selectedNodeId || !currentQuestionId) return;
  
  const answer = userAnswer.value.trim();
  if (!answer) {
    showNotification('提示', '请输入你的答案。', 'info');
    return;
  }
  
  fetch(`/api/topology/${currentTopologyId}/question/${currentQuestionId}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      answer: answer,
      node_id: selectedNodeId
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      questionCard.classList.add('hidden');
      answerFeedback.classList.remove('hidden');
      
      // 设置反馈样式
      if (data.data.correct) {
        feedbackCard.className = 'feedback-box success';
        feedbackTitle.textContent = '回答正确!';
        feedbackTitle.className = 'success-text';
      } else {
        feedbackCard.className = 'feedback-box error';
        feedbackTitle.textContent = '回答错误';
        feedbackTitle.className = 'error-text';
      }
      
      feedbackText.textContent = data.data.feedback;
      
      // 刷新图谱以反映掌握状态的变化
      fetch(`/api/topology/${currentTopologyId}`)
        .then(response => response.json())
        .then(graphData => {
          if (graphData.status === 'success') {
            renderGraph(graphData.data);
          }
        })
        .catch(error => {
          console.error('刷新图谱错误:', error);
        });
    } else {
      showNotification('错误', data.message, 'error');
    }
  })
  .catch(error => {
    console.error('提交答案错误:', error);
    showNotification('错误', '提交答案时发生错误，请重试。', 'error');
  });
})

// 获取下一个问题
nextQuestion.addEventListener('click', function() {
  if (!currentTopologyId || !selectedNodeId) return;
  
  answerFeedback.classList.add('hidden');
  getQuestion(selectedNodeId);
});

// 重置上传区域
function resetUpload() {
  progressContainer.classList.add('hidden');
  graphContainer.classList.add('hidden');
  quizContainer.classList.add('hidden');
  fileInput.value = '';
  selectedFile = null;
}

// 显示通知
function showNotification(title, message, type = 'info') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fa ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <div>
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
    <button class="close-btn"><i class="fa fa-times"></i></button>
  `;
  
  // 添加到页面
  document.body.appendChild(notification);
  
  // 显示通知
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // 关闭按钮
  const closeBtn = notification.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // 自动关闭
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 添加通知样式
  const style = document.createElement('style');
  style.innerHTML = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 15px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      transform: translateX(120%);
      transition: transform 0.3s ease;
      z-index: 1000;
      width: 350px;
    }
    
    .notification.show {
      transform: translateX(0);
    }
    
    .notification i {
      font-size: 24px;
    }
    
    .notification.success i {
      color: #2ecc71;
    }
    
    .notification.error i {
      color: #e74c3c;
    }
    
    .notification.info i {
      color: #3498db;
    }
    
    .notification h4 {
      font-size: 16px;
      margin-bottom: 5px;
    }
    
    .notification p {
      font-size: 14px;
      color: #7f8c8d;
    }
    
    .close-btn {
      background: transparent;
      border: none;
      color: #95a5a6;
      cursor: pointer;
      margin-left: auto;
      font-size: 16px;
    }
    
    .feedback-box {
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    
    .success {
      background-color: rgba(46, 204, 113, 0.1);
      border-left: 4px solid #2ecc71;
    }
    
    .error {
      background-color: rgba(231, 76, 60, 0.1);
      border-left: 4px solid #e74c3c;
    }
    
    .success-text {
      color: #2ecc71;
    }
    
    .error-text {
      color: #e74c3c;
    }
  `;
  document.head.appendChild(style);
});

