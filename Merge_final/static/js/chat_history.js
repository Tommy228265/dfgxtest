document.addEventListener('DOMContentLoaded', function() {
    const historyDataElement = document.getElementById('history-data');
    if (!historyDataElement) {
        console.error('历史记录数据未找到');
        document.getElementById('history-detail').innerHTML = '<p>无法加载记录详情</p>';
        return;
    }
    const historyData = JSON.parse(historyDataElement.textContent);
    console.log('historyData:', historyData);

    const sidebarItems = document.querySelectorAll('.sidebar-item');
    console.log('sidebarItems:', sidebarItems.length);

    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            sidebarItems.forEach(i => i.classList.remove('selected'));
            this.classList.add('selected');
            const questionId = this.getAttribute('data-question-id');
            const selectedItem = historyData.find(item => item.question_id === questionId);
            if (selectedItem) {
                document.getElementById('history-detail').innerHTML = `
                    <div class="history-item">
                        <h3>问题: ${selectedItem.question}</h3>
                        <p><strong>回答:</strong> ${selectedItem.answer || '无回答'}</p>
                        <!-- <p><strong>来源:</strong> ${selectedItem.source || '未知'}</p>
                        <p><strong>提问时间:</strong> ${selectedItem.created_at}</p>
                        <p><strong>回答时间:</strong> ${selectedItem.answer_created_at || '未回答'}</p>
                        <p><strong>相关文档:</strong> ${selectedItem.topology_content_preview || '无关联文档'}</p> -->
                    </div>
                `;
            } else {
                document.getElementById('history-detail').innerHTML = '<p>无法加载记录详情</p>';
            }
        });
    });

    if (sidebarItems.length > 0) {
        sidebarItems[0].classList.add('selected');
    }
});