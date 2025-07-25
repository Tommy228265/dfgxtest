import sqlite3
import os
import logging
from contextlib import closing

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('knowledge_graph.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 数据库文件路径（与 Flask 应用的 DATABASE 路径一致）
DATABASE = 'knowledge_graph.db'


def add_new_tables():
    """向现有数据库添加 chat_questions 和 chat_answers 表"""
    db_path = os.path.abspath(DATABASE)
    logger.info(f"连接数据库: {db_path}")

    # 确保数据库文件存在
    if not os.path.exists(db_path):
        logger.error(f"数据库文件 {db_path} 不存在，请确认路径或先运行 Flask 应用初始化数据库")
        return

    try:
        with closing(sqlite3.connect(db_path)) as db:
            cursor = db.cursor()

            # 检查现有表
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            existing_tables = {row[0] for row in cursor.fetchall()}
            logger.info(f"现有表: {existing_tables}")

            # 定义新表
            schema = """CREATE TABLE IF NOT EXISTS chat_questions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                topology_id TEXT,
                question TEXT NOT NULL,
                created_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (topology_id) REFERENCES topologies (id)
            );
            
            CREATE TABLE IF NOT EXISTS chat_answers (
                id TEXT PRIMARY KEY,
                question_id TEXT,
                answer TEXT NOT NULL,
                source TEXT,
                created_at TEXT,
                FOREIGN KEY (question_id) REFERENCES chat_questions (id)
            );"""

            # 执行建表语句
            cursor.executescript(schema)
            db.commit()
            logger.info("成功创建 chat_questions 和 chat_answers 表")

            # 验证表创建
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('chat_questions', 'chat_answers')")
            new_tables = {row[0] for row in cursor.fetchall()}
            if 'chat_questions' in new_tables and 'chat_answers' in new_tables:
                logger.info("验证成功: chat_questions 和 chat_answers 表已存在")
            else:
                logger.error("验证失败: 部分表未创建成功")

    except sqlite3.Error as e:
        logger.error(f"数据库操作失败: {str(e)}", exc_info=True)
    except Exception as e:
        logger.error(f"未知错误: {str(e)}", exc_info=True)


if __name__ == '__main__':
    add_new_tables()