// 全局变量
let network = null;
let currentTopologyId = null;
let selectedNodeId = null;
let currentQuestionId = null;
let currentQuizSession = null; // 当前问答会话
let topologyResults = {};
let selectedFile = null;
let maxNodes = 0;
let nodeActionModal = null; // 在全局声明节点操作模态框变量

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
const regenerateBtn = document.getElementById('regenerateBtn');
const nodeCountInput = document.getElementById('nodeCountInput');

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('页面加载完成，初始化完成'); // 调试信息
  
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
    
    /* 模态框样式 */
    .context-modal {
      display: none; /* 初始隐藏 */
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: rgba(0,0,0,0.4);
      transition: opacity 0.3s ease; /* 添加过渡动画 */
    }
    
    .context-modal.show {
      display: flex; /* 显示时使用flex布局 */
      opacity: 1;
    }
    
    .modal-content {
      background-color: #fefefe;
      margin: 10% auto;
      padding: 20px;
      border: 1px solid #888;
      width: 80%;
      max-width: 500px;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      transition: transform 0.3s ease; /* 添加过渡动画 */
      transform: translateY(0);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    }
    
    .modal-title {
      margin: 0;
      font-size: 1.5rem;
    }
    
    .close-modal {
      font-size: 1.5rem;
      font-weight: bold;
      cursor: pointer;
      background: none;
      border: none;
    }
    
    .modal-body {
      padding: 20px 0;
    }
    
    .action-buttons {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    
    .action-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font-size: 0.9rem;
    }
    
    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .icon-btn:hover {
      background-color: rgba(0,0,0,0.05);
    }
  `;
  document.head.appendChild(style);
  
  // 新增DOM元素 - 现在在文档加载事件内部获取
  const fileStatus = document.getElementById('fileStatus');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  
  // 确保正确获取节点操作模态框元素
  nodeActionModal = document.getElementById('nodeActionModal'); // 节点操作模态框
  const closeNodeActionModal = document.getElementById('closeNodeActionModal');
  const startQuizBtn = document.getElementById('startQuizBtn');
  const deleteNodeBtn = document.getElementById('deleteNodeBtn');

  // 文件选择事件
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      
      // 显示文件状态
      fileNameDisplay.textContent = selectedFile.name;
      fileStatus.classList.remove('hidden');
      
      // 添加按钮动画效果
      if (generateBtn) generateBtn.classList.add('pulse');
      
      // 添加上传区域高亮效果
      const uploadArea = document.querySelector('.upload-area');
      if (uploadArea) uploadArea.classList.add('file-selected');
      
      // 显示通知
      showNotification('文件已上传', `${selectedFile.name} 准备就绪，点击"开始生成"按钮`, 'success');
    } else {
      // 如果没有选择文件，重置状态
      if (fileStatus) fileStatus.classList.add('hidden');
      if (generateBtn) generateBtn.classList.remove('pulse');
      const uploadArea = document.querySelector('.upload-area');
      if (uploadArea) uploadArea.classList.remove('file-selected');
    }
  });

  // 开始生成按钮事件
  generateBtn.addEventListener('click', () => {
    if (!selectedFile) {
      showNotification('错误', '请先选择文件', 'error');
      return;
    }
    
    // 获取节点数量并验证
    const nodeCountValue = nodeCountInput.value.trim();
    maxNodes = nodeCountValue !== '' ? parseInt(nodeCountValue) : 0;
    
    // 显示进度区域
    if (progressContainer) progressContainer.classList.remove('hidden');
    if (graphContainer) graphContainer.classList.add('hidden');
    if (quizContainer) quizContainer.classList.add('hidden');
    
    // 重置进度
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercentage) progressPercentage.textContent = '0%';
    if (progressMessage) progressMessage.textContent = '准备处理文档...';
    
    // 移除按钮动画
    if (generateBtn) generateBtn.classList.remove('pulse');
    
    // 隐藏文件状态提示
    if (fileStatus) fileStatus.classList.add('hidden');
    
    // 移除上传区域高亮
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) uploadArea.classList.remove('file-selected');
    
    // 创建表单数据
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('max_nodes', maxNodes);  // 添加 max_nodes 参数
    
    // 调用新的API开始生成
    startGeneration(formData);
  });

  // 新的API调用函数
  function startGeneration(formData) {
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
    if (progressContainer) progressContainer.classList.remove('hidden');
    if (graphContainer) graphContainer.classList.add('hidden');
    if (quizContainer) quizContainer.classList.add('hidden');
    
    // 重置进度
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercentage) progressPercentage.textContent = '0%';
    if (progressMessage) progressMessage.textContent = '准备上传文档...';
    
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
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressPercentage) progressPercentage.textContent = `${progress}%`;
            if (progressMessage) progressMessage.textContent = data.message || '处理中...';
          } else if (data.status === 'success') {
            clearInterval(interval);
            renderGraph(data.data);
            if (nodeCount) nodeCount.textContent = data.node_count;
            if (edgeCount) edgeCount.textContent = data.edge_count;
            if (progressContainer) progressContainer.classList.add('hidden');
            if (graphContainer) graphContainer.classList.remove('hidden');
            if (quizContainer) quizContainer.classList.remove('hidden');
            if (noQuestion) noQuestion.classList.remove('hidden');
            if (questionCard) questionCard.classList.add('hidden');
            if (answerFeedback) answerFeedback.classList.add('hidden');
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

  // 更新节点颜色设置（点亮节点）
  function updateNodeColor(node) {
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

    return style;
  }

  // 渲染知识图谱
  function renderGraph(graphData) {
    console.log('开始渲染图谱，节点数:', graphData.nodes.length); // 调试信息
    
    // 销毁现有网络
    if (network !== null) {
      network.destroy();
    }
    
    // 创建节点和边
    const nodes = new vis.DataSet(graphData.nodes);
    const edges = new vis.DataSet(graphData.edges);
    
    // 设置节点样式
    nodes.update(graphData.nodes.map(node => {
      return {
        ...node,
        ...updateNodeColor(node)
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
    if (networkContainer) {
      network = new vis.Network(networkContainer, data, options);
    } else {
      console.error('网络容器元素未找到');
      return;
    }
    
    // 添加网络渲染完成事件监听
    network.once('afterDrawing', () => {
      console.log('图谱渲染完成');
      
      // 验证特定节点状态
      if (selectedNodeId) {
        const node = nodes.get(selectedNodeId);
        if (node) {
          console.log(`渲染后节点 ${selectedNodeId} 颜色:`, node.color);
        }
      }
    });
    
    // 节点点击事件 - 修复弹窗显示问题
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        selectedNodeId = params.nodes[0];
        
        // 显示节点操作模态框（修复后的逻辑）
        if (nodeActionModal) {
          // 移除隐藏类并添加显示类
          nodeActionModal.classList.remove('hidden');
          nodeActionModal.classList.add('show');
          
          // 设置模态框位置（防止屏幕边缘）
          const rect = network.getBoundingBox(selectedNodeId);
          const pos = network.getPosition(selectedNodeId);
          
          const networkRect = networkContainer.getBoundingClientRect();
          const modalWidth = 300;
          const modalHeight = 150;
          
          let modalLeft = pos.x + networkRect.left;
          let modalTop = pos.y + networkRect.top;
          
          // 确保模态框在可视区域内
          if (modalLeft + modalWidth > window.innerWidth) {
            modalLeft = window.innerWidth - modalWidth - 20;
          }
          if (modalTop + modalHeight > window.innerHeight) {
            modalTop = window.innerHeight - modalHeight - 20;
          }
          
          // 应用位置
          nodeActionModal.style.left = `${modalLeft}px`;
          nodeActionModal.style.top = `${modalTop}px`;
        }
      }
    });
    
    // 节点悬停事件
    network.on('hoverNode', function(params) {
      const node = nodes.get(params.node);
      network.setOptions({
        nodes: {
          title: `<div class="tooltip"><b>${node.label}</b><br>掌握程度: ${node.mastery_score || 0}/10<br>连续正确: ${node.consecutive_correct}</div>`
        }
      });
    });
    
    // 搜索节点 - 添加空值检查
    if (searchNode) {
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
    } else {
      console.error('搜索节点输入框未找到');
    }
    
    // 刷新图谱 - 添加空值检查
    if (refreshGraph) {
      refreshGraph.addEventListener('click', function() {
        console.log('手动刷新图谱...');
        fetchAndUpdateGraph();
      });
    } else {
      console.error('刷新按钮未找到');
    }
  }

  // 新增：备选的图谱刷新方法
  function fetchAndUpdateGraph() {
    console.log('尝试通过fetchAndUpdateGraph更新图谱...'); // 调试信息
    
    if (!currentTopologyId) {
      console.error('当前拓扑ID不存在');
      return;
    }
    
    fetch(`/api/topology/${currentTopologyId}`)
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          console.log('获取图谱数据成功，节点数:', data.node_count); // 调试信息
          
          // 验证特定节点状态
          const node = data.data.nodes.find(n => n.id === selectedNodeId);
          if (node) {
            console.log(`节点 ${selectedNodeId} 状态:`, node.mastered ? '已掌握' : '未掌握');
          } else {
            console.log(`未找到节点 ${selectedNodeId}`);
          }
          
          renderGraph(data.data);
          if (nodeCount) nodeCount.textContent = data.node_count;
          if (edgeCount) edgeCount.textContent = data.edge_count;
        } else {
          console.error('获取图谱数据失败:', data.message);
          showNotification('错误', '刷新图谱时发生错误，请重试。', 'error');
        }
      })
      .catch(error => {
        console.error('刷新图谱错误:', error);
        showNotification('错误', '刷新图谱时发生错误，请重试。', 'error');
      });
  }

  // 新增：开始问答会话
  function startQuizSession(nodeId) {
    console.log(`开始节点 ${nodeId} 的问答会话`); // 调试信息
    
    // 重置UI
    if (noQuestion) noQuestion.classList.add('hidden');
    if (questionCard) questionCard.classList.remove('hidden');
    if (answerFeedback) answerFeedback.classList.add('hidden');
    if (userAnswer) userAnswer.value = '';
    
    // 初始化会话
    currentQuizSession = {
      nodeId: nodeId,
      questionsAnswered: 0,
      consecutiveCorrect: 0,
      mastered: false,
      sessionId: null // 会话ID将从API响应中获取
    };
    
    getQuestion(nodeId);
  }

  // 获取问题（更新以支持会话）
  function getQuestion(nodeId) {
    if (!currentTopologyId || !nodeId) return;
    
    if (noQuestion) noQuestion.classList.add('hidden');
    if (questionCard) questionCard.classList.remove('hidden');
    if (answerFeedback) answerFeedback.classList.add('hidden');
    
    // 携带会话ID获取问题
    const sessionParam = currentQuizSession && currentQuizSession.sessionId 
      ? `?session_id=${currentQuizSession.sessionId}` 
      : '';
    
    console.log(`获取节点 ${nodeId} 的问题，会话ID: ${currentQuizSession?.sessionId || '无'}`); // 调试信息
    
    fetch(`/api/topology/${currentTopologyId}/node/${nodeId}/question${sessionParam}`)
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          // 处理已掌握的情况
          if (data.mastered) {
            console.log(`节点 ${nodeId} 已掌握`); // 调试信息
            if (noQuestion) noQuestion.classList.remove('hidden');
            if (questionCard) questionCard.classList.add('hidden');
            showNotification('提示', '该知识点已掌握！', 'info');
            currentQuizSession = null;
            return;
          }
          
          if (currentQuestion) currentQuestion.textContent = data.data.question;
          currentQuestionId = data.data.question_id;
          currentQuizSession.sessionId = data.data.session_id; // 保存会话ID
          if (userAnswer) {
            userAnswer.value = '';
            userAnswer.focus();
          }
          
          console.log(`获取问题成功，问题ID: ${currentQuestionId}, 会话ID: ${currentQuizSession.sessionId}`); // 调试信息
        } else {
          console.error('获取问题失败:', data.message); // 调试信息
          showNotification('错误', data.message, 'error');
          if (noQuestion) noQuestion.classList.remove('hidden');
          if (questionCard) questionCard.classList.add('hidden');
          currentQuizSession = null;
        }
      })
      .catch(error => {
        console.error('获取问题错误:', error);
        showNotification('错误', '获取问题时发生错误，请重试。', 'error');
        if (noQuestion) noQuestion.classList.remove('hidden');
        if (questionCard) questionCard.classList.add('hidden');
        currentQuizSession = null;
      });
  }

  // 提交答案（更新以支持会话）
  submitAnswer.addEventListener('click', function() {
    if (!currentTopologyId || !selectedNodeId || !currentQuestionId || !currentQuizSession) return;
    
    const answer = userAnswer.value.trim();
    if (!answer) {
      showNotification('提示', '请输入你的答案。', 'info');
      return;
    }
    
    console.log(`提交问题 ${currentQuestionId} 的答案，节点ID: ${selectedNodeId}, 会话ID: ${currentQuizSession.sessionId}`); // 调试信息
    
    fetch(`/api/topology/${currentTopologyId}/question/${currentQuestionId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        answer: answer,
        node_id: currentQuizSession.nodeId,
        session_id: currentQuizSession.sessionId
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        // 更新会话状态
        currentQuizSession.questionsAnswered++;
        currentQuizSession.consecutiveCorrect = data.data.consecutive_correct;
        currentQuizSession.mastered = data.data.mastered;
        
        console.log(`答案提交成功，是否正确: ${data.data.correct}, 连续正确: ${currentQuizSession.consecutiveCorrect}, 是否已掌握: ${currentQuizSession.mastered}`); // 调试信息
        
        // 显示反馈
        if (feedbackTitle) feedbackTitle.textContent = data.data.correct ? '回答正确!' : '回答错误';
        if (feedbackCard) feedbackCard.className = data.data.correct ? 'feedback-box success' : 'feedback-box error';
        
        // 清空现有反馈内容并添加新内容
        if (feedbackText) {
          feedbackText.innerHTML = '';
          const feedbackParagraph = document.createElement('p');
          feedbackParagraph.textContent = data.data.feedback;
          feedbackText.appendChild(feedbackParagraph);
          
          // 添加下一步提示
          const nextStep = document.createElement('p');
          if (data.data.mastered) {
            nextStep.textContent = '恭喜！你已掌握该知识点！';
            nextStep.className = 'success-text';
          } else if (data.data.next_question) {
            nextStep.textContent = '系统正在准备下一个问题...';
          } else {
            nextStep.textContent = '请完善你的回答并再次提交';
          }
          feedbackText.appendChild(nextStep);
        }
        
        // 更新UI
        if (questionCard) questionCard.classList.add('hidden');
        if (answerFeedback) answerFeedback.classList.remove('hidden');
        
        // 如果已掌握，更新图谱并重置会话
        if (data.data.mastered) {
          console.log(`知识点 ${selectedNodeId} 已掌握，准备刷新图谱...`); // 调试信息
          
          // 使用备选方法刷新图谱
          fetchAndUpdateGraph();
          
          setTimeout(() => {
            if (answerFeedback) answerFeedback.classList.add('hidden');
            if (noQuestion) noQuestion.classList.remove('hidden');
            currentQuizSession = null;
            console.log('问答会话已重置'); // 调试信息
          }, 3000);
        } 
        // 如果有下一个问题，自动加载
        else if (data.data.next_question) {
          currentQuestionId = data.data.next_question.id;
          if (currentQuestion) currentQuestion.textContent = data.data.next_question.question;
          setTimeout(() => {
            if (answerFeedback) answerFeedback.classList.add('hidden');
            if (questionCard) questionCard.classList.remove('hidden');
            if (userAnswer) {
              userAnswer.value = '';
              userAnswer.focus();
            }
          }, 2000);
        }
      }
    })
    .catch(error => {
      console.error('提交答案错误:', error);
      showNotification('错误', '提交答案时发生错误，请重试。', 'error');
    });
  })

  // 获取下一个问题（保留以备扩展）
  nextQuestion.addEventListener('click', function() {
    if (!currentTopologyId || !selectedNodeId) return;
    
    if (answerFeedback) answerFeedback.classList.add('hidden');
    getQuestion(selectedNodeId);
  });

  // 重新生成按钮事件处理
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', function() {
        if (!currentTopologyId) {
            showNotification('提示', '请先生成知识图谱', 'info');
            return;
        }
        
        // 获取图谱部分的节点数量输入框的值
        const nodeCountValue = document.getElementById('graphNodeCountInput').value.trim();
        const maxNodes = nodeCountValue !== '' ? parseInt(nodeCountValue) : 0;
        
        // 显示进度
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressPercentage.textContent = '0%';
            progressMessage.textContent = '开始重新生成...';
        }
        
        // 调用重新生成API，传递新的节点数量
        fetch(`/api/topology/${currentTopologyId}/regenerate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                max_nodes: maxNodes // 传递新的节点数量
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 更新节点和边数量显示
                if (nodeCount) nodeCount.textContent = data.node_count;
                if (edgeCount) edgeCount.textContent = data.edge_count;
                
                // 重新获取图谱数据并渲染
                fetchAndUpdateGraph();
                showNotification('成功', '知识图谱重新生成成功', 'success');
            } else {
                showNotification('错误', data.message, 'error');
            }
        })
        .catch(error => {
            console.error('重新生成图谱错误:', error);
            showNotification('错误', '重新生成图谱时发生错误，请重试。', 'error');
        })
        .finally(() => {
            if (progressContainer) progressContainer.classList.add('hidden');
        });
    });
  }
  
  // 节点操作 - 进入问答模式 - 添加空值检查
  if (startQuizBtn) {
    startQuizBtn.addEventListener('click', function() {
      // 添加淡出动画
      if (nodeActionModal) {
        nodeActionModal.classList.remove('show');
        setTimeout(() => {
          nodeActionModal.classList.add('hidden');
          startQuizSession(selectedNodeId);
        }, 300);
      }
    });
  } else {
    console.error('开始问答按钮未找到');
  }

  // 节点操作 - 删除节点 - 添加空值检查
  if (deleteNodeBtn) {
    deleteNodeBtn.addEventListener('click', function() {
      if (!selectedNodeId) return;
      
      // 添加淡出动画
      if (nodeActionModal) {
        nodeActionModal.classList.remove('show');
        setTimeout(() => {
          nodeActionModal.classList.add('hidden');
          
          // 获取当前网络的数据
          if (network && network.body && network.body.data) {
            const nodes = network.body.data.nodes;
            const edges = network.body.data.edges;
            
            // 1. 找到所有需要删除的节点（选中的节点及其所有子节点）
            const nodesToDelete = new Set();
            nodesToDelete.add(selectedNodeId);
            
            // 递归查找子节点
            function findChildren(nodeId) {
              edges.get().forEach(edge => {
                if (edge.from === nodeId) {
                  nodesToDelete.add(edge.to);
                  findChildren(edge.to);
                }
              });
            }
            findChildren(selectedNodeId);
            
            // 2. 过滤节点和边
            const filteredNodes = nodes.get().filter(node => !nodesToDelete.has(node.id));
            const filteredEdges = edges.get().filter(edge => 
              !nodesToDelete.has(edge.from) && !nodesToDelete.has(edge.to)
            );
            
            // 3. 更新网络
            nodes.clear();
            nodes.add(filteredNodes);
            
            edges.clear();
            edges.add(filteredEdges);
            
            // 更新节点和边计数
            if (nodeCount) nodeCount.textContent = filteredNodes.length;
            if (edgeCount) edgeCount.textContent = filteredEdges.length;
          }
        }, 300);
      }
    });
  } else {
    console.error('删除节点按钮未找到');
  }

  // 关闭节点操作模态框 - 添加空值检查
  if (closeNodeActionModal) {
    closeNodeActionModal.addEventListener('click', function() {
      // 添加淡出动画
      if (nodeActionModal) {
        nodeActionModal.classList.remove('show');
        setTimeout(() => {
          nodeActionModal.classList.add('hidden');
        }, 300);
      }
    });
  } else {
    console.error('关闭模态框按钮未找到');
  }
  
  // 点击模态框背景关闭 - 添加空值检查
  if (nodeActionModal) {
    nodeActionModal.addEventListener('click', function(e) {
      if (e.target === this) { // 点击背景时关闭
        this.classList.remove('show');
        setTimeout(() => {
          this.classList.add('hidden');
        }, 300);
      }
    });
  } else {
    console.error('节点操作模态框未找到');
  }
  
  // 节点数量输入验证 - 添加空值检查
  if (nodeCountInput) {
    nodeCountInput.addEventListener('input', function() {
      // 只允许数字和空值
      this.value = this.value.replace(/[^\d]/g, '');
      // 限制最小值为0
      if (this.value < 0) this.value = 0;
    });
  } else {
    console.error('节点数量输入框未找到');
  }
});

// 在全局添加关闭模态框的事件
document.addEventListener('click', function(e) {
  // 点击背景关闭模态框
  if (nodeActionModal && !nodeActionModal.classList.contains('hidden') && 
      e.target === nodeActionModal) {
    nodeActionModal.classList.remove('show');
    setTimeout(() => {
      nodeActionModal.classList.add('hidden');
    }, 300);
  }
});

// 重置上传区域
function resetUpload() {
  console.log('重置上传区域和会话状态'); // 调试信息
  
  if (progressContainer) progressContainer.classList.add('hidden');
  if (graphContainer) graphContainer.classList.add('hidden');
  if (quizContainer) quizContainer.classList.add('hidden');
  if (fileInput) fileInput.value = '';
  selectedFile = null;
  currentQuizSession = null; // 重置会话
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
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    });
  }
  
  // 自动关闭
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}