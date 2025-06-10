<?php
// 数据库配置
$host = 'localhost';
$dbname = 'number_checker';
$username = 'root'; 
$password = '';     

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die("数据库连接失败: " . $e->getMessage());
}

// 处理AJAX请求
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // 检查是否是保存答案记录请求
    if (isset($_POST['question'])) {
        $question = $_POST['question'];
        $userAnswer = $_POST['user_answer'];
        $correctAnswer = $_POST['correct_answer'];
        $isCorrect = (bool)$_POST['is_correct'];
        $confidence = isset($_POST['confidence']) ? floatval($_POST['confidence']) : 0.0;
        $feedback = isset($_POST['feedback']) ? $_POST['feedback'] : null;
        
        try {
            $pdo->beginTransaction();
            
            // 插入答案记录
            $stmt = $pdo->prepare("
                INSERT INTO ai_answers 
                (question, user_answer, correct_answer, is_correct, confidence, feedback, timestamp) 
                VALUES (:question, :user_answer, :correct_answer, :is_correct, :confidence, :feedback, NOW())
            ");
            $stmt->execute([
                'question' => $question,
                'user_answer' => $userAnswer,
                'correct_answer' => $correctAnswer,
                'is_correct' => $isCorrect ? 1 : 0,
                'confidence' => $confidence,
                'feedback' => $feedback
            ]);
            
            // 获取记录ID
            $recordId = $pdo->lastInsertId();
            
            // 获取时间戳
            $timestamp = date('Y-m-d H:i:s');
            
            // 提交事务
            $pdo->commit();
            
            // 返回成功响应
            echo json_encode([
                'success' => true,
                'recordId' => $recordId,
                'timestamp' => $timestamp
            ]);
            
        } catch(PDOException $e) {
            // 回滚事务
            $pdo->rollBack();
            
            // 返回错误响应
            echo json_encode([
                'success' => false,
                'message' => '数据库错误: ' . $e->getMessage()
            ]);
        }
    } 
    // 检查是否是获取AI问题请求
    elseif (isset($_POST['question_type']) && $_POST['question_type'] === 'ai') {
        // 这里应该调用实际的API获取AI相关问题
        // 为了演示，我们返回一个模拟的AI问题库
        
        $aiQuestions = [
            [
                "question" => "什么是机器学习中的过拟合？如何避免过拟合？",
                "answer" => "过拟合是指模型在训练数据上表现良好，但在未见过的数据上表现不佳的现象。\n\n避免过拟合的方法包括：\n1. 增加训练数据\n2. 使用正则化技术(L1/L2)\n3. 采用集成学习方法\n4. 提前停止训练\n5. 简化模型结构"
            ],
            [
                "question" => "简述卷积神经网络(CNN)的基本结构和应用场景。",
                "answer" => "卷积神经网络(CNN)是一种专门为处理具有网格结构数据(如图像)而设计的深度学习模型。\n\n其基本结构包括：\n1. 卷积层(Convolutional Layer)：提取特征\n2. 池化层(Pooling Layer)：降维\n3. 全连接层(Fully Connected Layer)：分类决策\n\n常见应用场景：\n- 图像识别与分类\n- 目标检测\n- 语义分割\n- 人脸识别"
            ],
            [
                "question" => "什么是自然语言处理(NLP)中的词向量？列举几种常见的词向量表示方法。",
                "answer" => "词向量是将文本中的词语表示为实数向量的技术，能够捕捉词语之间的语义关系。\n\n常见的词向量表示方法包括：\n1. 独热编码(One-Hot Encoding)\n2. 词袋模型(Bag of Words)\n3. TF-IDF\n4. Word2Vec(包括CBOW和Skip-gram)\n5. GloVe(Global Vectors for Word Representation)\n6. BERT等预训练模型生成的上下文词向量"
            ],
            [
                "question" => "解释强化学习中的策略梯度方法。",
                "answer" => "策略梯度方法是强化学习中的一类算法，直接对策略函数进行优化。\n\n与基于值函数的方法(如Q-learning)不同，策略梯度方法通过估计策略的梯度来直接优化策略参数，使得期望累积奖励最大化。\n\n主要优点：\n1. 适用于连续动作空间\n2. 能够学习随机策略\n3. 通常具有更好的收敛性\n\n常见算法：\n- REINFORCE\n- Actor-Critic\n- A2C/A3C\n- PPO"
            ],
            [
                "question" => "简述生成对抗网络(GAN)的基本原理和结构。",
                "answer" => "生成对抗网络(GAN)由两部分组成：生成器(Generator)和判别器(Discriminator)，通过对抗训练的方式相互博弈。\n\n基本原理：\n1. 生成器尝试生成逼真的数据\n2. 判别器尝试区分真实数据和生成的数据\n3. 两者通过对抗训练共同优化\n\n结构：\n- 生成器：接收随机噪声作为输入，输出伪造数据\n- 判别器：接收真实或伪造数据作为输入，输出概率值\n\n应用领域：\n- 图像生成\n- 风格迁移\n- 数据增强\n- 超分辨率"
            ]
        ];
        
        // 随机选择一个问题
        $randomQuestion = $aiQuestions[array_rand($aiQuestions)];
        
        // 返回问题和答案
        echo json_encode($randomQuestion);
    }
    else {
        // 无效请求
        echo json_encode([
            'success' => false,
            'message' => '无效的请求参数'
        ]);
    }
}
?>