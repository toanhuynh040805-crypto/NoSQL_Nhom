# Nghiệp vụ sơ đồ bàn và gọi món (chuyển từ KLCN sang NoSQL)

## Đã triển khai trong nhánh feat/klcn-staff-table-ordering

1. Phục vụ đăng nhập được chuyển thẳng tới `/staff/tables`; thu ngân cũng mở sơ đồ bàn; quản lý có link truy cập.
2. Hiển thị sơ đồ theo khu, màu trống/đặt/đang phục vụ, tổng số chỗ, lượng khách, lịch đặt đã xác nhận.
3. Phục vụ nhận bàn thường hoặc bàn đặt đã xác nhận. Dùng MongoDB `table_sessions` và unique partial index để chống mở hai phiên hoạt động trên cùng một bàn.
4. Redis quản lý quyền thao tác bàn 5 phút (`table:lock:<sessionId>`), có nhận, gia hạn, trả quyền; nhân viên khác được xem nhưng không được gửi món khi khóa còn hiệu lực.
5. Chọn món, ghi chú, tăng giảm số lượng, gửi từng lượt order từ đúng bàn; MongoDB lưu snapshot giá tại lúc gọi. `clientRequestId` chống tạo trùng đơn khi gửi lại.
6. Bếp tiếp nhận các order đã xác nhận trong màn hình `/kitchen` (đang polling 10 giây). Khi bếp báo sẵn sàng, phục vụ xác nhận đã mang ra.
7. Thu ngân xác nhận đã thanh toán từng lượt; chỉ được kết thúc phiên khi toàn bộ lượt món không hủy đã phục vụ và thanh toán. Nếu còn đặt bàn đã xác nhận thì bàn trở lại trạng thái đặt, thay vì trả trống bừa bãi.
8. Lưu nhật ký mở bàn, gọi món và đóng phiên ở `TableSession.activity`. Giữ nguyên đường gọi món cho khách hàng hiện có.

## Phân quyền

| Quyền | Phục vụ | Bếp | Thu ngân | Quản lý |
|---|---|---|---|---|
| Xem sơ đồ | Có | Không | Có | Có |
| Nhận bàn và gọi món | Có | Không | Không | Có |
| Chuyển món sang đang làm / sẵn sàng | Không (trong UI mới) | Có | Không | Có (màn hình bếp) |
| Đánh dấu đã phục vụ | Có | Không | Không | Có |
| Xác nhận thanh toán | Không | Không | Có | Có |
| Kết thúc phiên và trả bàn | Không | Không | Có | Có |

## Chạy thử an toàn

- Khởi động Docker và backend/frontend như README; nếu MongoDB hiện có dữ liệu cần giữ thì **không chạy `npm run seed`**.
- Đăng nhập `staff@quanan.vn` (tài khoản mẫu sau khi seed); mặc định mở `/staff/tables`.
- Chọn bàn trống -> nhận bàn -> giữ khóa 5 phút -> thêm món -> gửi bếp.
- Đăng nhập `bep@quanan.vn` ở trình duyệt khác, vào `/kitchen`: bắt đầu chế biến và báo sẵn sàng.
- Trở lại nhân viên phục vụ: đánh dấu đã phục vụ.
- Đăng nhập `thungan@quanan.vn`, chọn bàn -> xác nhận thu tiền -> kết thúc phiên -> sơ đồ bàn cập nhật.
- Thử hai nhân viên nhận cùng bàn hoặc gọi món khi nhân viên khác giữ khóa: phải bị chặn.
- Khi có phiên đang phục vụ, quản trị không thể tự đổi trạng thái bàn hoặc ngừng sử dụng bàn; thu ngân yêu cầu phục vụ trả quyền trước khi đóng phiên.

## Còn cần chuyển từ KLCN để đạt đầy đủ nghiệp vụ

- Session hóa các đơn do khách web/QR tạo để chia sẻ một phiên bàn duy nhất với phục vụ; mã QR an toàn gắn phiên bàn.
- Realtime WebSocket/SignalR tương đương cho bếp, phục vụ, thu ngân và thông báo (thay thế polling).
- Nhận bàn thường có giữ lịch đặt 30 phút, tự động hóa đến giờ/quá giờ, chống xung đột đặt bàn.
- Tách, gộp, chuyển bàn với nhật ký, chặn gộp hai khách thành viên khác nhau, giữ tên thành viên khi tách.
- Ưu tiên món ở cấp từng món, sửa/hủy món khi chưa chế biến và đồng bộ bếp.
- Phiếu tạm tính, QR thanh toán, đặt cọc, trừ cọc, áp dụng điểm loyalty vào hóa đơn, chống thanh toán trùng.
- Quản lý ca làm, khu vực phụ trách, GPS/check-in, phân quyền chi tiết; thống kê khách và báo cáo mở rộng.
- Audit logs bền vững, kiểm thử giao dịch cạnh tranh và stress tests, xử lý phục hồi khi đồng bộ Neo4j/Redis bị lỗi.

Ghi chú: Đây là phần **đã bổ sung thật** để bắt đầu chuyển nghiệp vụ, không tuyên bố toàn bộ KLCN đã được chuyển xong. Với đơn hàng khách web hiện có nhưng chưa gắn `TableSession`, cần xử lý trong luồng `/operations?tab=orders` cho đến khi triển khai hợp nhất phiên QR/web.
