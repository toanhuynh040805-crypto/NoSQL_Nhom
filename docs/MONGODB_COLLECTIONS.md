# Thiết kế collection MongoDB

## users

```json
{
  "_id": "ObjectId",
  "fullName": "Nguyễn Văn A",
  "email": "vana@example.com",
  "phone": "0988123456",
  "passwordHash": "bcrypt hash",
  "role": "customer",
  "isActive": true,
  "createdAt": "Date"
}
```

## foods

Mỗi món tham chiếu một `categories._id`; các tags được nhúng để tìm kiếm và phân loại linh hoạt.

## orders

`items` được nhúng trong đơn và giữ bản chụp `name`, `price`. Vì vậy thay đổi giá món sau này không làm sai lịch sử đơn.

## reviews

Tham chiếu khách hàng, món và đơn. Unique index trên bộ ba này ngăn đánh giá trùng một món trong cùng đơn.

