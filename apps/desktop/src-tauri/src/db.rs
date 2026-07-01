//! SQLite本地存储模块
//! 提供数据库初始化、模式迁移和基本读/写

use rusqlite::{Connection, OptionalExtension};
use std::path::{Path, PathBuf};

/// 解析数据库路径
pub fn resolve_db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("mineradio.db")
}

pub fn open_connection(db_path: &Path) -> rusqlite::Result<Connection> {
    Connection::open(db_path)
}

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    // 确保 _migrations 表本身存在
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            name    TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    // 查出已执行过的最大 version
    let latest: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM _migrations",
        [],
        |row| row.get(0),
    )?;

    // 从 latest+1 开始,逐个执行未应用的迁移
    apply_migration(conn, 1, "create_kv_store", latest < 1)?;
    apply_migration(conn, 2, "create_listen_history", latest < 2)?;

    Ok(())
}

fn apply_migration(
    conn: &Connection,
    version: i64,
    name: &str,
    should_apply: bool,
) -> rusqlite::Result<()> {
    if !should_apply {
        return Ok(());
    }
    let sql = match version {
        1 => MIGRATION_V1_SQL,
        2 => MIGRATION_V2_SQL,
        _ => {
            return Err(rusqlite::Error::ToSqlConversionFailure(
                format!("unknown migration version: {version}").into(),
            ))
        }
    };
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(sql)?;
    tx.execute_batch(&format!(
        "INSERT INTO _migrations (version, name) VALUES ({version}, '{name}');"
    ))?;
    tx.commit()?;
    Ok(())
}

const MIGRATION_V1_SQL: &str = r#"
    CREATE TABLE IF NOT EXISTS kv_store (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
"#;

const MIGRATION_V2_SQL: &str = r#"
    CREATE TABLE IF NOT EXISTS listen_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_key TEXT NOT NULL,
        name TEXT NOT NULL,
        artist TEXT NOT NULL,
        cover TEXT,
        source TEXT,
        played_at TEXT NOT NULL DEFAULT (datetime('now')),
        listen_ms INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_listen_history_song ON listen_history(song_key);
    CREATE INDEX IF NOT EXISTS idx_listen_history_played ON listen_history(played_at);
"#;

fn get_kv(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM kv_store WHERE key = ?1", [key], |row| {
        row.get(0)
    })
    .optional()
}

fn set_kv(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO kv_store (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');",
        [key, value],
    )?;
    tx.commit()?;
    Ok(())
}

pub fn add_listen_history(
    conn: &Connection,
    song_key: &str,
    name: &str,
    artist: &str,
    cover: Option<&str>,
    source: Option<&str>,
    listen_ms: i64,
    completed: bool,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO listen_history
            (song_key, name, artist, cover, source, listen_ms, completed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            song_key,
            name,
            artist,
            cover,
            source,
            listen_ms,
            completed as i64
        ],
    )?;
    Ok(())
}

pub fn current_migration_version(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM _migrations",
        [],
        |row| row.get(0),
    )
}

fn get_startup_count(conn: &Connection) -> rusqlite::Result<i64> {
    match get_kv(conn, "startup_count")? {
        Some(value) => value
            .parse::<i64>()
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e))),
        None => Ok(0),
    }
}

pub fn increment_startup_count(conn: &Connection) -> rusqlite::Result<i64> {
    let current_count = get_startup_count(conn)?;
    let new_count = current_count + 1;
    set_kv(conn, "startup_count", &new_count.to_string())?;
    Ok(new_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn
    }

    #[test]
    fn test_resolve_db_path() {
        let app_data_dir = Path::new("/path/to/app/data");
        let expected_path = Path::new("/path/to/app/data/mineradio.db");
        assert_eq!(resolve_db_path(app_data_dir), expected_path);
    }

    #[test]
    fn test_open_connection() {
        let db_path = Path::new(":memory:"); // 使用内存数据库进行测试
        let conn_result: Result<Connection, rusqlite::Error> = open_connection(db_path);
        assert!(conn_result.is_ok());
    }

    #[test]
    fn migrations_creates_tables() {
        let conn = fresh_db();
        // 假设有一个迁移函数 `run_migrations`，需要实现
        assert!(run_migrations(&conn).is_ok());
        let result = conn.execute_batch("SELECT COUNT(*) FROM _migrations");
        assert!(result.is_ok());
    }

    #[test]
    fn test_migrations_is_idempotent() {
        let conn = fresh_db();
        assert!(run_migrations(&conn).is_ok());
        // 再次运行迁移，确保不会出错
        let result = run_migrations(&conn);
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_kv_missing_key_returns_none() {
        let conn = fresh_db();
        run_migrations(&conn).unwrap();
        let result = get_kv(&conn, "nope");
        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_set_and_get_kv() {
        let conn = fresh_db();
        run_migrations(&conn).unwrap();
        set_kv(&conn, "test_key", "hello").unwrap();
        let result = get_kv(&conn, "test_key");
        assert_eq!(result.unwrap(), Some("hello".to_string()));
    }

    #[test]
    // 测试 set_kv 是否会覆盖已有的键值
    fn test_set_kv_overwrites() {
        let conn = fresh_db();
        run_migrations(&conn).unwrap();
        set_kv(&conn, "test_key", "hello").unwrap();
        set_kv(&conn, "test_key", "world").unwrap();
        let result = get_kv(&conn, "test_key");
        assert_eq!(result.unwrap(), Some("world".to_string()));
    }

    #[test]
    fn test_v2_migration_creates_listen_history() {
        let conn = fresh_db();
        assert!(run_migrations(&conn).is_ok());
        // 检查 listen_history 表是否存在
        let result = conn.execute_batch("SELECT COUNT(*) FROM listen_history");
        assert!(result.is_ok());
    }

    #[test]
    fn test_add_listen_history_inserts_row() {
        let conn = fresh_db();
        run_migrations(&conn).unwrap();

        add_listen_history(
            &conn,
            "id:123",
            "歌名",
            "歌手",
            Some("https://example.com/cover.jpg"), // cover 有值
            Some("netease"),                       // source 有值
            30000,                                 // 听了 30 秒
            false,                                 // 没听完
        )
        .unwrap();

        // 查询:listen_history 表里应该有 1 行
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM listen_history", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_get_startup_count_returns_zero_when_empty() {
        let conn: Connection = fresh_db();
        run_migrations(&conn).unwrap();
        let count = get_startup_count(&conn).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_increment_startup_count_increments() {
        let conn = fresh_db();
        run_migrations(&conn).unwrap();

        // 调一次: 0 → 1
        let after_first = increment_startup_count(&conn).unwrap();
        assert_eq!(after_first, 1);

        // 再调一次: 1 → 2 (这才是"递增"的关键)
        let after_second = increment_startup_count(&conn).unwrap();
        assert_eq!(after_second, 2);
    }

    #[test]
    fn test_current_migration_version_returns_max() {
        // 先跑迁移,让 _migrations 表存在
        let conn = fresh_db();
        run_migrations(&conn).unwrap();

        // 跑过迁移: 应该返回最大 version
        let v = current_migration_version(&conn).unwrap();
        assert!(v >= 1);
    }
}
