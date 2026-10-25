# ERD

현재 MVP는 단일 엔티티만 사용한다.

```text
+------------------+
| Transaction       |
+------------------+
| id (PK)           |
| type              |
| amount            |
| date              |
| category          |
| memo              |
| createdAt         |
+------------------+
```

`Category`는 고정 선택지이므로 별도 저장하지 않는다. 사용자별 동기화가 필요해지면 `User 1--* Transaction` 관계를 추가하고, 카테고리 사용자화가 필요해질 때 `Category 1--* Transaction`으로 승격한다.

