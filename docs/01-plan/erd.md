# ERD 및 시트 관계

```text
User (Google 계정)
  1
  |
  *
Transaction  * ---- 1  Category
      |
      *
   Settings (앱 전역 설정)
```

개인 전용 배포에서는 `User`를 별도 시트에 저장하지 않고 Apps Script의 Google 계정 권한으로 처리한다. 향후 가족 공유를 지원할 때만 `owner_email` 또는 별도 사용자 권한 시트를 추가한다.

`Transaction.category`는 `Categories.name`을 참조한다. `Categories`가 비활성화되어도 기존 거래의 카테고리 문자열은 보존한다.

