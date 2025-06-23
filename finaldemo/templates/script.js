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
      
      // 设置反馈内容
      if (data.data.correct) {
        feedbackTitle.textContent = '回答正确!';
        feedbackTitle.className = 'success-text';
        feedbackCard.className = 'feedback-box success';
      } else {
        feedbackTitle.textContent = '回答错误';
        feedbackTitle.className = 'error-text';
        feedbackCard.className = 'feedback-box error';
      }
      
      feedbackText.textContent = data.data.feedback;
      
      // 显示连续正确次数
      if (data.data.consecutive_correct > 0) {
        const consecutiveCount = document.createElement('div');
        consecutiveCount.className = 'consecutive-count';
        consecutiveCount.textContent = `连续正确: ${data.data.consecutive_correct}/3`;
        feedbackCard.appendChild(consecutiveCount);
      }
      
      // 刷新图谱以反映掌握状态的变化
      if (network) {
        fetch(`/api/topology/${currentTopologyId}`)
          .then(response => response.json())
          .then(graphData => {
            if (graphData.status === 'success') {
              renderGraph(graphData.data);
            }
          });
      }
    } else {
      showNotification('错误', data.message, 'error');
    }
  })
  .catch(error => {
    console.error('提交答案错误:', error);
    showNotification('错误', '提交答案时发生错误，请重试。', 'error');
  });
});

// 下一个问题
nextQuestion.addEventListener('click', function() {
  if (!selectedNodeId) {
    noQuestion.classList.remove('hidden');
    answerFeedback.classList.add('hidden');
    return;
  }
  
  getQuestion(selectedNodeId);
});

// 重置上传状态
function resetUpload() {
  uploadContainer.classList.remove('hidden');
  progressContainer.classList.add('hidden');
  graphContainer.classList.add('hidden');
  quizContainer.classList.add('hidden');
  fileInput.value = '';
  currentTopologyId = null;
  selectedNodeId = null;
  currentQuestionId = null;
  ignoreNodeBtn.disabled = true;
}

// 显示通知
function showNotification(title, message, type = 'info') {
  // 检查是否已有通知
  let notification = document.querySelector('.notification');
  if (notification) {
    notification.remove();
  }
  
  // 创建通知元素
  notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // 设置图标
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'exclamation-circle';
  
  notification.innerHTML = `
    <i class="fa fa-${icon}"></i>
    <div>
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
    <button class="close-btn">&times;</button>
  `;
  
  // 添加到页面
  document.body.appendChild(notification);
  
  // 显示通知
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // 自动关闭
  const closeBtn = notification.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // 3秒后自动关闭
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// 点击模态框外部关闭
contextModal.addEventListener('click', function(e) {
  if (e.target === contextModal) {
    contextModal.classList.add('hidden');
  }
});

// 键盘事件
document.addEventListener('keydown', function(e) {
  // ESC键关闭模态框
  if (e.key === 'Escape') {
    contextModal.classList.add('hidden');
  }
});