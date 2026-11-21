# Thiết kế key Redis

| Key pattern | Kiểu dữ liệu | TTL | Mục đích |
|---|---|---:|---|
| `cart:user:<userId>` | Hash | 24 giờ | Giỏ của khách đã đăng nhập |
| `cart:guest:<cartId>` | Hash | 24 giờ | Giỏ khách chưa đăng nhập |
| `menu:categories` | String/JSON | 5 phút | Cache danh mục |
| `leaderboard:foods` | Sorted Set | Không | Xếp hạng món theo số lượng đã gọi |
| `token:block:<jti>` | String | Bằng thời hạn token | Thu hồi token khi đăng xuất |

