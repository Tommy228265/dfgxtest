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
    // 检查是否是验证答案请求
    if (isset($_POST['isCorrect'])) {
        $isCorrect = (bool)$_POST['isCorrect'];
        
        try {
            $pdo->beginTransaction();
            
            // 插入答案记录
            $stmt = $pdo->prepare("INSERT INTO answers (is_correct, timestamp) VALUES (:is_correct, NOW())");
            $stmt->execute([
                'is_correct' => $isCorrect ? 1 : 0
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
    // 检查是否是获取问题请求
    elseif (isset($_POST['question_type'])) {
        // 这里应该调用实际的API获取问题
        // 为了演示，我们返回一个模拟的数学问题
        
        $operators = ['+', '-', '*', '/'];
        $operator = $operators[array_rand($operators)];
        
        $num1 = rand(1, 20);
        $num2 = rand(1, 10);
        
        // 确保减法和除法的结果是正数和整数
        if ($operator === '-') {
            if ($num1 < $num2) {
                $temp = $num1;
                $num1 = $num2;
                $num2 = $temp;
            }
        } elseif ($operator === '/') {
            $num1 = $num2 * rand(1, 5); // 确保整除
        }
        
        // 计算答案
        switch ($operator) {
            case '+':
                $answer = $num1 + $num2;
                break;
            case '-':
                $answer = $num1 - $num2;
                break;
            case '*':
                $answer = $num1 * $num2;
                break;
            case '/':
                $answer = $num1 / $num2;
                break;
        }
        
        // 返回问题和答案
        echo json_encode([
            'question' => "$num1 $operator $num2 = ?",
            'answer' => (string)$answer
        ]);
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