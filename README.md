# IOT-Water_monitor-UTC2

**Hệ thống giám sát chất lượng nước theo thời gian thực sử dụng ESP32, Cloudflare Worker và Redis**

## Mô tả

Dự án này là báo cáo học phần IOT tại Trường Đại học Giao thông Vận tải Phân hiệu TP.HCM (UTC2). Hệ thống sử dụng ESP32 để thu thập dữ liệu từ các cảm biến chất lượng nước như:
- 🌡️ Nhiệt độ
- ⚗️ pH
- 💧 TDS (Tổng chất rắn hòa tan)
- 🌫️ Độ đục (Turbidity)

Dữ liệu được gửi qua **Cloudflare Worker** và lưu trữ vào **Upstash Redis**, sau đó hiển thị trên giao diện web dashboard để giám sát và cảnh báo theo thời gian thực.

### Nhóm thực hiện
| Họ và tên         | MSSV        | Lớp         |
|-------------------|-------------|-------------|
| Lê Minh Phúc      | 6351030056  | K63.TĐHĐK   |
| Lê Thanh Vương    | 6351030086  | K63.TĐHĐK   |
| Trần Hoàng Nghĩa  | 6351030047  | K63.TĐHĐK   |
| Nguyễn Huy Hậu    | 6351030026  | K63.TĐHĐK   |

---

## Chức năng chính

- Thu thập dữ liệu môi trường nước
- Gửi dữ liệu thời gian thực lên cloud
- Hiển thị dữ liệu và biểu đồ trực tuyến
- Cảnh báo vượt ngưỡng
- Giao tiếp hai chiều từ web đến ESP32
- Cấu hình WiFi trực tiếp từ ESP32 (qua WebServer)

---
## Giao diện điều khiển
Truy cập giao diện giám sát tại: **[https://iot.ophus.site](https://iot.ophus.site)**

## Cấu trúc thư mục

```bash
├── firmware/                # Mã nguồn ESP32 (Arduino)
│   ├── IOT_V2.ino
│   └── ...
├── web/                     # Giao diện web và mã nguồn frontend/backend
│   ├── index.html
│   ├── style.css
│   └── main.js
│   ├── index.js
│   └── ...
├── workers/                 # Mã nguồn chính của Worker (nhận/gửi dữ liệu từ ESP32 và Redis) 
|   ├──Worker_esp32-data-receiver.js
│   └── ...
├── README.md               # Tài liệu hướng dẫn
└── LICENSE
```

## Lưu đồ thuật toán
![Lưu đồ thuật toán](https://github.com/user-attachments/assets/84c9f3a5-9527-4fc7-973c-8b94511f112e)
![462011082-c60ab354-c91f-44b7-bb17-1a3a11189dfc](https://github.com/user-attachments/assets/dea50526-95d0-4080-9470-480f6bc2b8ca)
## Sơ đồ khối
![Sơ đồ khối](https://github.com/user-attachments/assets/14dbfaaa-9a37-4167-8575-6d364a35e36b)
## Sơ đồ nguyên lý
![Sơ đồ nguyên lý](https://github.com/user-attachments/assets/5b2fbbf6-34c0-44c0-9863-9f1fb76d3b82)

## Giao diện hệ thống
![Dashboard](https://github.com/user-attachments/assets/8b2df6de-b104-4b3a-912a-ac48409f7cbc)
