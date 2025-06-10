<?php
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


if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $number = isset($_POST['number']) ? intval($_POST['number']) : null;
    if ($number === null) {
        echo json_encode([
            'success' => false,
            'message' => '请输入有效的整数',
            'isEven' => false
        ]);
        exit;
    }
    $isEven = ($number % 2 == 0);
    
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("INSERT INTO checks (number, is_even, timestamp) VALUES (:number, :is_even, NOW())");
        $stmt->execute([
            'number' => $number,
            'is_even' => $isEven ? 1 : 0
        ]);
        
       
        $recordId = $pdo->lastInsertId();
        
       
        $timestamp = date('Y-m-d H:i:s');
        
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => '验证成功',
            'isEven' => $isEven,
            'recordId' => $recordId,
            'timestamp' => $timestamp
        ]);
        
    } catch(PDOException $e) {

        $pdo->rollBack();
        
        echo json_encode([
            'success' => false,
            'message' => '数据库错误: ' . $e->getMessage(),
            'isEven' => $isEven
        ]);
    }
}
?>
    