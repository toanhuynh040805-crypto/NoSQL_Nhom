# Website quản lý đặt món tại quán ăn

Dự án môn NoSQL sử dụng đồng thời ba mô hình dữ liệu:

- **MongoDB (document):** nguồn dữ liệu chính cho tài khoản, danh mục, món ăn, đơn hàng và đánh giá.
- **Redis (key-value):** giỏ hàng có thời hạn 24 giờ, cache danh mục, token đăng xuất và bảng xếp hạng món bán chạy.
- **Neo4j (graph):** đồ thị `Customer → Food → Category`; các quan hệ `ORDERED`, `REVIEWED`, `BELONGS_TO` được dùng để gợi ý món.

Source này là dự án độc lập. Dữ liệu minh họa và một số ảnh món ăn được điều chỉnh từ KLCN của nhóm; không kết nối hoặc thay đổi cơ sở dữ liệu SQL Server của KLCN.

## Chức năng đã triển khai

### Khách hàng

- Đăng ký, đăng nhập, đăng xuất.
- Xem, tìm kiếm, lọc thực đơn.
- Nhận gợi ý món từ Neo4j; tự chuyển sang món phổ biến nếu chưa đủ dữ liệu.
- Thêm, sửa số lượng, xóa món trong giỏ hàng Redis.
- Đặt món dùng tại quán hoặc mang về.
- Theo dõi trạng thái và lịch sử đơn.
- API đánh giá món trong đơn đã hoàn thành.
- Tự động chuyển giỏ khách sang tài khoản sau khi đăng nhập/đăng ký.
- Quản lý hồ sơ, đổi mật khẩu, điểm thành viên và món yêu thích.
- Đặt bàn, chọn khu vực, theo dõi hoặc hủy yêu cầu đặt bàn.
- Xem khuyến mãi, nhập mã giảm giá và chọn phương thức thanh toán.
- Nhận thông báo khi đơn hàng hoặc lịch đặt bàn thay đổi.

### Quản trị

- Dashboard khách hàng, món ăn, đơn đang xử lý, bàn, đặt bàn và doanh thu ngày.
- Quản lý đơn hàng, thanh toán, quy trình xác nhận → chế biến → sẵn sàng → hoàn thành.
- Quản lý món, ảnh món, danh mục, bàn, đặt bàn, khách hàng, nhân viên và phân quyền.
- Quản lý khuyến mãi và báo cáo doanh thu/món bán chạy theo thời gian.
- Quản lý kho nguyên liệu, nhập/xuất kho và cảnh báo sắp hết hàng.
- Màn hình bếp riêng, tự cập nhật danh sách món mỗi 10 giây.

### Vai trò hệ thống

| Vai trò | Phạm vi chính |
|---|---|
| `admin` | Toàn bộ hệ thống, thực đơn, người dùng, báo cáo |
| `staff` | Đơn hàng, đặt bàn và sơ đồ bàn |
| `kitchen` | Nhận món, bắt đầu chế biến và báo món sẵn sàng |
| `cashier` | Thanh toán, hoàn tất đơn và báo cáo doanh thu |
| `customer` | Đặt món, đặt bàn và các chức năng khách hàng |

## Kiến trúc

```text
React/Vite (5173)
       │ REST API + JWT
Node.js/Express (5000)
       ├── MongoDB (27017): dữ liệu nghiệp vụ
       ├── Redis   (6379): giỏ hàng, cache, leaderboard
       └── Neo4j   (7687): quan hệ và gợi ý món
```

## Chạy dự án

Yêu cầu: Node.js 20+, npm và Docker Desktop.

```bash
# 1. Tạo file cấu hình trên Windows PowerShell
Copy-Item .env.example .env

# 2. Khởi động ba cơ sở dữ liệu
docker compose up -d

# 3. Cài thư viện
npm run install:all

# 4. Tạo dữ liệu mẫu (chạy sau khi container đã sẵn sàng)
npm run seed

# 5. Mở hai terminal trong VS Code
npm run dev:backend
npm run dev:frontend
```

Truy cập:

- Website: <http://localhost:5173>
- API: <http://localhost:5000/api/health>
- Neo4j Browser: <http://localhost:7474> (`neo4j` / `restaurant123`)

Tài khoản mẫu sau khi seed:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị | `admin@quanan.vn` | `123456` |
| Khách hàng | `khach@quanan.vn` | `123456` |
| Phục vụ | `staff@quanan.vn` | `123456` |
| Bếp | `bep@quanan.vn` | `123456` |
| Thu ngân | `thungan@quanan.vn` | `123456` |

## Luồng dữ liệu đặt món

1. Khách chọn món; API lưu từng mục vào hash Redis `cart:user:<id>` hoặc `cart:guest:<id>`.
2. Khi xác nhận, API đọc giỏ Redis và lấy lại giá hiện hành từ MongoDB để tránh tin giá từ trình duyệt.
3. Đơn hàng và bản chụp tên/giá món được ghi vào collection `orders` của MongoDB.
4. Redis tăng điểm trong sorted set `leaderboard:foods` và xóa giỏ hàng.
5. Neo4j tăng quan hệ `(Customer)-[:ORDERED]->(Food)` để làm dữ liệu gợi ý.

## Một số API chính

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký |
| `POST` | `/api/auth/login` | Đăng nhập |
| `GET` | `/api/foods` | Xem/tìm/lọc món |
| `GET` | `/api/recommendations` | Gợi ý món |
| `GET` | `/api/cart` | Đọc giỏ Redis |
| `PUT` | `/api/cart/items/:foodId` | Thêm/sửa món trong giỏ |
| `POST` | `/api/orders` | Tạo đơn từ giỏ |
| `GET` | `/api/orders/mine` | Lịch sử đơn |
| `POST` | `/api/reviews` | Đánh giá món |
| `GET` | `/api/admin/dashboard` | Thống kê quản trị |

## Quy trình bàn phục vụ (nâng cấp từ KLCN)

- Phục vụ, thu ngân và quản lý có trang **/staff/tables** với sơ đồ bàn, lịch đặt, phiên bàn, gọi món trực tiếp và thanh toán.
- Mỗi bàn chỉ có một phiên active; khóa quyền chỉnh sửa bằng Redis trong 5 phút.
- Gọi món theo lượt (staff orders), bếp xử lý, phục vụ xác nhận đã mang món ra, thu ngân xác nhận thanh toán trước khi kết thúc phiên.
- Hướng dẫn và phần KLCN còn thiếu: [docs/STAFF_ORDER_WORKFLOW.md](docs/STAFF_ORDER_WORKFLOW.md).

## Ngoài phạm vi bản đồ án hiện tại

- Tích hợp cổng thanh toán thật và xử lý callback từ nhà cung cấp thanh toán.
- Tích hợp đơn vị giao hàng, bản đồ và theo dõi tài xế theo thời gian thực.
- Kết nối máy in bếp, máy in hóa đơn và hóa đơn điện tử theo môi trường triển khai thực tế.
- Bổ sung kiểm thử tự động, giám sát hệ thống và quy trình sao lưu để triển khai production.
- Chuẩn hóa báo cáo thực nghiệm: thời gian truy vấn, cache hit/miss, truy vấn Cypher và ảnh minh chứng ba CSDL.

