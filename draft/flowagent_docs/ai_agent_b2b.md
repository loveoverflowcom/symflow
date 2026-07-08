# **Tổ Hợp Công Nghệ Và Kiến Trúc Hạ Tầng Tối Ưu Cho Việc Cung Cấp Giải Pháp AI Agent Doanh Nghiệp (B2B SaaS)**

Việc chuyển đổi từ một ứng dụng trí tuệ nhân tạo (AI) chạy cục bộ phục vụ mục đích cá nhân sang một nền tảng dịch vụ cấp doanh nghiệp (B2B SaaS) đòi hỏi những thay đổi căn bản về mặt kiến trúc phần mềm, hạ tầng kỹ thuật, mô hình cấp phép pháp lý và cơ chế bảo mật1. Một trợ lý AI cá nhân hoạt động dựa trên các tài nguyên máy tính cục bộ và lưu trữ lịch sử dưới dạng các tập tin tĩnh1. Ngược lại, một giải pháp thương mại hóa hướng đến các doanh nghiệp nhỏ và vừa (SMEs) phải đối mặt với các bài toán phức tạp về vận hành đồng thời, cô lập dữ liệu khách hàng nghiêm ngặt, quản trị ngân sách tài nguyên và khả năng tích hợp linh hoạt vào các hệ thống quản trị sẵn có của khách hàng3.  
Bản báo cáo kỹ thuật này phân tích chi tiết các tổ hợp công nghệ, mô hình thiết kế hạ tầng và các giao thức tích hợp tiêu chuẩn để xây dựng một nền tảng AI Agent thương mại hóa bền vững, an toàn và tối ưu chi phí.

## **Khung Điều Phối Quy Trình Và Ràng Buộc Bản Quyền Thương Mại**

Lớp điều phối (Orchestration Layer) là trung tâm đầu não điều khiển hành vi, luồng xử lý và khả năng tự động hóa của các tác nhân AI6. Đối với các nhà phát triển giải pháp SaaS, quyết định lựa chọn công nghệ ở lớp này không chỉ bị chi phối bởi các tính năng kỹ thuật mà còn phụ thuộc chặt chẽ vào mô hình cấp phép bản quyền (Licensing) và khả năng tùy chỉnh thương hiệu (White-labeling)2.

### **Đánh giá các khung điều phối phổ biến cho mục đích thương mại hóa**

| Tiêu chí so sánh | n8n (Community Edition) | Activepieces | Dify (Community) | Flowise | Workflow Builder |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Giấy phép bản quyền (License)** | Sustainable Use License (SUL)2 | MIT Core8 | Apache 2.0 (có điều khoản hạn chế dịch vụ đám mây)6 | MIT6 | Apache 2.011 |
| **Quyền đóng gói thương mại (White-label)** | Bị hạn chế nghiêm ngặt; yêu cầu thỏa thuận thương mại riêng biệt9 | Được phép tự do đóng gói; bản Enterprise hỗ trợ sẵn SSO và quản lý thương hiệu8 | Không được phép bán lại dưới dạng dịch vụ đám mây cạnh tranh (Cloud hosting)6 | Hoàn toàn tự do thương mại hóa và đóng gói không ràng buộc6 | Thiết kế dưới dạng React SDK không giới hạn quyền phân phối SaaS11 |
| **Kiến trúc đa thuê (Multi-tenancy)** | Giới hạn ở bản Enterprise trả phí14 | Tích hợp sẵn trong phân khúc Enterprise14 | Hỗ trợ phân vùng Workspace và phân quyền vai trò (RBAC)6 | Hỗ trợ cơ bản nhưng thiếu khả năng phân quyền chi tiết7 | Hỗ trợ toàn diện đa thuê ở cấp độ ứng dụng11 |
| **Mô hình hàng đợi (Queue Model)** | Đơn tiến trình mặc định; cần cấu hình thủ công để mở rộng9 | Hỗ trợ mở rộng qua các Worker đám mây15 | Tích hợp sẵn Celery \+ Redis cho các tiến trình bất đồng bộ7 | Hỗ trợ Worker nhưng chưa tối ưu cho tải luồng dữ liệu lớn7 | Tùy biến linh hoạt theo hạ tầng của ứng dụng chủ11 |
| **Yêu cầu tài nguyên tĩnh (Idle RAM)** | \~512 MB8 | \~512 MB8 | \~3 GB (Bao gồm Weaviate, Celery, Redis, PostgreSQL)6 | \~512 MB6 | Phụ thuộc vào ứng dụng tích hợp11 |

### **Rủi ro pháp lý và kỹ thuật từ các dự án nguồn mở phổ biến**

Phần lớn các kỹ sư khi xây dựng nguyên mẫu thường lựa chọn n8n do thư viện kết nối phong phú (hơn 400 tích hợp có sẵn) và giao diện trực quan mạnh mẽ8. Tuy nhiên, n8n không phải là một dự án mã nguồn mở chuẩn OSI mà sử dụng giấy phép nguồn mở có điều kiện (SUL)2. Điều khoản này quy định rõ: nếu đơn vị triển khai nhúng n8n làm động cơ xử lý phía sau (SaaS backend) cho một sản phẩm thương mại mà khách hàng bên ngoài có thể kích hoạt quy trình hoặc sử dụng thông tin xác thực của riêng họ để kết nối với các dịch vụ bên ngoài, hệ thống đó bắt buộc phải có giấy phép thương mại (thường bắt đầu từ mức chi phí rất cao lên tới $25.000 \- $50.000 mỗi năm)2. Việc bỏ qua điều khoản này tạo ra rủi ro pháp lý nghiêm trọng khi doanh nghiệp tiến hành gọi vốn, kiểm toán hoặc bị yêu cầu rà soát bản quyền9.  
Đối với nền tảng Dify, đây là một hệ thống LLMOps toàn diện tích hợp sẵn cơ chế quản lý tri thức RAG và quản lý prompt6. Dù hoạt động dưới giấy phép Apache 2.0, Dify đính kèm điều khoản bổ sung cấm việc sử dụng mã nguồn để xây dựng một dịch vụ đám mây cạnh tranh trực tiếp6. Hơn thế nữa, các nghiên cứu an ninh mạng đã công bố một số lỗ hổng nghiêm trọng liên quan đến cơ chế đa thuê của Dify Cloud, điển hình là CVE-2026-41947 (cho phép truy cập dữ liệu log ghi vết hội thoại của các tài khoản doanh nghiệp khác nếu biết ID ứng dụng) và CVE-2026-41948 (cho phép can thiệp vào các API nội bộ thông qua lỗ hổng Plugin Daemon)20. Điều này buộc các nhà phát triển giải pháp B2B khi tự host Dify phải triển khai thêm các lớp Middleware xác thực (ví dụ như FastAPI Wrapper) để lọc và kiểm soát chặt chẽ ranh giới dữ liệu giữa các Workspace17.  
Nếu mục tiêu của doanh nghiệp là cung cấp một nền tảng SaaS có tích hợp sẵn trình thiết kế quy trình (Workflow Builder) cho chính người dùng cuối tự thao tác, việc lựa chọn *Activepieces* (với nhân MIT Core tự do tuyệt đối) hoặc *Workflow Builder* (dưới dạng một React SDK headless) là phương án tối ưu để loại bỏ hoàn toàn các rủi ro pháp lý và tối giản chi phí hạ tầng ban đầu8.

## **Hạ Tầng Cổng Gateway Và Quản Trị Đa Thuê**

Trong mô hình dịch vụ B2B, việc cho phép các tác nhân AI gọi trực tiếp đến API của các nhà cung cấp mô hình (như OpenAI, Anthropic) là một sai lầm về mặt kiến trúc21. Hệ thống cần một lớp trung gian quản lý tài nguyên – Cổng AI Gateway – nhằm đảm bảo tính sẵn sàng cao, phân phối tải ổn định và giám sát chặt chẽ chi phí vận hành21.

### **Quản trị tài nguyên GPU và hiện tượng láng giềng ồn ào (Noisy Neighbor)**

Kiến trúc tính toán của mô hình ngôn ngữ lớn trên hạ tầng GPU có những đặc thù khác biệt hoàn toàn so với các ứng dụng web truyền thống1:

* **Tính không thể phân chia của các slot xử lý lô (GPU Batch Slots):** Một vi xử lý đồ họa chuyên dụng (như Nvidia H100) chạy các mô hình lớn thông qua kỹ thuật gom lô liên tục (Continuous Batching) và phân trang bộ nhớ chú ý (Paged Attention) chỉ có thể xử lý đồng thời một số lượng chuỗi (sequences) giới hạn (dao động từ 40 đến 80 yêu cầu đồng thời tùy thuộc vào độ dài ngữ cảnh)1.  
* **Sự suy giảm hiệu năng chéo:** Trong môi trường đa thuê dùng chung hạ tầng, khi một khách hàng gửi một lượng truy vấn lớn đột biến, họ sẽ chiếm dụng phần lớn các slot tính toán trên GPU1. Do không có cơ chế cô lập tài nguyên ở cấp độ hệ điều hành như CPU, hành vi này trực tiếp làm gia tăng độ trễ phản hồi (latency) của tất cả các khách hàng khác trên cùng hệ thống1.  
* **Sự sai lệch trong đo lường mã thông báo (Tokens):** Việc tính toán chi phí chỉ dựa trên tổng số token thô (Raw Token Count) không phản ánh chính xác gánh nặng tính toán thực tế trên GPU1. Một truy vấn có độ dài 1.000 token đi kèm một hệ thống prompt dài 4.000 token đã được lưu bộ đệm tiền tố (Prefix Caching) tiêu tốn ít tài nguyên tính toán hơn nhiều so với một truy vấn tương đương không sử dụng bộ đệm1.

### **Cơ chế giới hạn tốc độ và phân bổ ngân sách đa tầng**

Để giải quyết triệt để các thách thức trên, hệ thống bắt buộc phải triển khai một cổng AI Gateway sử dụng bộ lưu trữ phân tán hiệu năng cao (Redis) để thực hiện kiểm tra hạn mức tức thời (In-Memory Quota Checking) với độ trễ tối thiểu (trung bình chỉ từ ![][image1] đến ![][image2] dưới tải cực đại)1.  
Kiến trúc cổng Gateway nên áp dụng mô hình phân bổ ngân sách theo 4 cấp bậc để ngăn chặn tình trạng một Agent hoạt động lỗi gây cạn kiệt toàn bộ tài nguyên hệ thống22:  
![][image3]  
Hệ thống ghi nhận và thực thi các giới hạn này thông qua hai cấu trúc dữ liệu chính trên Redis đối với mỗi tenant1:

1. **Cửa sổ trượt (Sliding Window):** Sử dụng cấu trúc danh sách sắp xếp (ZADD với mốc thời gian) để theo dõi và thực thi giới hạn số lượng yêu cầu mỗi phút (RPM) nhằm bảo vệ hệ thống khỏi các cuộc tấn công từ chối dịch vụ hoặc lỗi lặp vô hạn1.  
2. **Thùng chứa mã thông báo (Daily Token Bucket):** Sử dụng cơ chế tăng giá trị nguyên tử (INCRBY có thiết lập thời gian sống TTL đến nửa đêm giờ UTC) để tích lũy lượng token tiêu thụ trong ngày1.

Khi lượng tiêu thụ vượt qua các ngưỡng quy định, hệ thống thực hiện các kịch bản thực thi mềm dẻo1:

* **Cấp độ Cảnh báo (Warning \- Tiêu thụ đạt 80%):** Tiếp tục xử lý yêu cầu nhưng bổ sung tiêu đề phản hồi X-Quota-Warning: 20% remaining để hệ thống phía khách hàng ghi nhận chủ động1.  
* **Cấp độ Giới hạn Mềm (Soft Limit \- Tiêu thụ đạt 100% ngày):** Chặn các yêu cầu tiếp theo và phản hồi mã lỗi 429 Too Many Requests đi kèm tiêu đề Retry-After thiết lập mốc thời gian thiết lập lại hạn mức (nửa đêm UTC)1.  
* **Cấp độ Giới hạn Cứng (Hard Limit \- Tiêu thụ đạt 100% tháng):** Từ chối hoàn toàn dịch vụ bằng mã lỗi 403 Forbidden cho đến khi tài khoản được nạp thêm ngân sách hoặc bước sang chu kỳ thanh toán mới1.

## **Giải Pháp Lưu Trữ Dữ Liệu Và Động Cơ Vector (RAG Layer)**

Để các tác nhân AI hoạt động hiệu quả trong môi trường doanh nghiệp, chúng cần quyền truy cập vào các kho tri thức nội bộ được tổ chức thông qua cơ chế RAG (Retrieval-Augmented Generation)6. Việc lựa chọn động cơ lưu trữ vector có ảnh hưởng trực tiếp đến chi phí biên trên mỗi khách hàng (FinOps)25.

### **Đánh giá các cơ sở dữ liệu vector trong phân khúc SMEs**

| Tiêu chí kỹ thuật | pgvector \+ pgvectorscale | Qdrant | Milvus |
| :---- | :---- | :---- | :---- |
| **Mô hình kiến trúc** | Tiện ích mở rộng tích hợp trực tiếp trên cơ sở dữ liệu PostgreSQL có sẵn25 | Động cơ chuyên biệt hiệu năng cao viết hoàn toàn bằng ngôn ngữ Rust26 | Hệ thống phân tán dạng vi dịch vụ (Microservices) chạy trên Kubernetes26 |
| **Ràng buộc hạ tầng** | Không phát sinh thêm hệ thống mới; tận dụng cấu hình PostgreSQL hiện tại24 | Chạy như một dịch vụ đơn lẻ cực kỳ nhẹ, không có phụ thuộc bên ngoài26 | Phụ thuộc phức tạp vào etcd (quản lý metadata), Pulsar/Kafka (WAL), và MinIO/S326 |
| **Hiệu năng truy vấn kèm bộ lọc** | Rất tốt; tối ưu hóa thông qua các câu lệnh SQL JOIN truyền thống25 | Xuất sắc; hỗ trợ bộ lọc JSON Payload trực tiếp trên đồ thị HNSW24 | Xuất sắc; hỗ trợ tìm kiếm song song phân tán trên quy mô cực đại26 |
| **Quy mô dữ liệu tối ưu** | Dưới 100 triệu vectors24 | Dưới 50 triệu vectors24 | Hàng tỷ vectors27 |
| **Chi phí vận hành nhàn rỗi** | **Không phát sinh chi phí hạ tầng bổ sung** \[cite: 24, 25\] | Thấp; hoạt động mượt mà trên các dòng máy chủ ảo (VPS) cấu hình nhỏ26 | Rất cao; yêu cầu duy trì nhiều Kubernetes Pods cho các dịch vụ nền26 |

### **Chiến lược lựa chọn tối ưu cho nhà cung cấp giải pháp B2B**

Đối với các nhà cung cấp giải pháp hướng tới phân khúc khách hàng doanh nghiệp nhỏ và vừa, việc hạn chế tối đa số lượng dịch vụ phải duy trì (Maintenance overhead) là nguyên tắc cốt lõi để duy trì biên lợi nhuận tốt25.

* **pgvector kết hợp với pgvectorscale** là giải pháp thực tế nhất24. Bằng việc kích hoạt tiện ích này trên hệ quản trị cơ sở dữ liệu PostgreSQL quen thuộc, nhà phát triển không cần phải thiết lập, vận hành và sao lưu thêm bất kỳ hệ thống dữ liệu nào khác25. Toàn bộ dữ liệu quan hệ truyền thống và dữ liệu nhúng (embeddings) đều nằm chung trong một bảng, cho phép thực hiện các truy vấn phức tạp kết hợp điều kiện lọc phân quyền khách hàng bằng câu lệnh SQL tiêu chuẩn24. Các nghiên cứu hiệu năng cho thấy tiện ích pgvectorscale đạt tốc độ xử lý lên tới 471 QPS (Queries Per Second) với độ chính xác recall 99% trên tập dữ liệu 50 triệu vector, vượt trội hơn so với một số cấu hình mặc định của các cơ sở dữ liệu vector chuyên biệt24.  
* **Qdrant** là lựa chọn thay thế tối ưu nếu ứng dụng yêu cầu xử lý tìm kiếm vector thuần túy với độ trễ cực thấp trong môi trường đa thuê25. Qdrant hỗ trợ tính năng nén lượng tử hóa (Quantization) giúp giảm dung lượng RAM chiếm dụng của đồ thị HNSW xuống nhiều lần mà không làm suy giảm đáng kể độ chính xác của kết quả tìm kiếm26.  
* **Milvus** hoàn toàn không phù hợp cho quy mô SMEs26. Kiến trúc phân tách hoàn toàn giữa tính toán và lưu trữ của Milvus chỉ phát huy hiệu quả khi hệ thống đạt đến quy mô hàng trăm triệu hoặc hàng tỷ vector26. Chi phí duy trì hạ tầng tối thiểu cho một cụm Milvus hoạt động ổn định (bao gồm cả các thành phần phụ thuộc etcd, Pulsar, MinIO) sẽ nhanh chóng ăn mòn lợi nhuận của một dự án SaaS ở giai đoạn đầu26.

## **Tiêu Chuẩn Hóa Giao Tiếp Và Tích Hợp Hệ Thống Doanh Nghiệp**

Sự phân rã của hệ sinh thái AI dẫn đến tình trạng mỗi tác nhân và mỗi ứng dụng lại yêu cầu một phương thức kết nối dữ liệu riêng biệt, gây bùng nổ chi phí phát triển và bảo trì30. Để giải quyết bài toán này, ngành công nghiệp AI đã thiết lập các giao thức tiêu chuẩn hóa ở hai lớp giao tiếp khác nhau: **Model Context Protocol (MCP)** và **Agent Client Protocol (ACP)**4.

### **Kiến trúc tiêu chuẩn hóa giao tiếp đa tầng**

 \+---------------------------------------------------------+  
 |                 Ứng dụng chủ / Code Editor              |  
 \+---------------------------------------------------------+  
                              |  
                     (Giao thức ACP) \[cite: 34, 35, 36\]  
                              |  
 \+---------------------------------------------------------+  
 |                       AI Agent                          |  
 \+---------------------------------------------------------+  
                              |  
                     (Giao thức MCP) \[cite: 34, 35, 36\]  
                              |  
 \+---------------------------------------------------------+  
 |          Công cụ / Dữ liệu (ERP, CRM, DB)               |  
 \+---------------------------------------------------------+

* **Model Context Protocol (MCP):** Được Anthropic công bố vào cuối năm 2024 và hiện được bảo trợ bởi Agentic AI Foundation thuộc Linux Foundation, MCP chuẩn hóa cách thức một mô hình ngôn ngữ lớn kết nối với các công cụ, dữ liệu và tài nguyên bên ngoài (Model-to-Tool)30. Nó hoạt động như một bộ chuyển đổi vạn năng, cho phép Agent tự động khám phá và thực thi các thao tác dữ liệu trên các hệ thống CRM, ERP mà không cần viết các đoạn mã tích hợp điểm-điểm (point-to-point connectors)4.  
* **Agent Client Protocol (ACP):** Được phát triển bởi Zed Industries và JetBrains, ACP chuẩn hóa giao tiếp giữa giao diện người dùng (chủ yếu là trình biên tập mã nguồn hoặc ứng dụng chủ) và bản thân tác nhân AI (Editor-to-Agent)33. Giao thức này sử dụng cơ chế JSON-RPC 2.0 truyền tải qua luồng vào/ra tiêu chuẩn (stdio) để truyền nhận các yêu cầu tạo phiên làm việc, gửi prompt và kết xuất kết quả dưới dạng cấu trúc khác biệt (diffs) trực tiếp lên màn hình35.

### **Rủi ro bảo mật của hệ thống Agent tích hợp MCP trong doanh nghiệp**

Việc trao quyền cho các tác nhân AI truy cập trực tiếp vào các hệ thống thông tin cốt lõi của doanh nghiệp qua MCP mở ra những lỗ hổng an ninh mạng nghiêm trọng39:

1. **Tấn công tiêm nhiễm chỉ thị gián tiếp (Indirect Prompt Injection):** Đây là rủi ro có sức phá hoại lớn nhất đối với hệ thống Agentic AI40. Kẻ tấn công không cần xâm nhập trực tiếp vào hệ thống thông tin của doanh nghiệp; họ chỉ cần chèn các dòng lệnh ẩn bằng ngôn ngữ tự nhiên vào các tài liệu mà Agent chắc chắn sẽ xử lý (ví dụ: nội dung một email yêu cầu hỗ trợ, một tệp PDF hóa đơn hoặc một trang web được Agent duyệt qua)41. Khi Agent đọc tài liệu này qua MCP, nó sẽ hiểu nhầm các chỉ thị độc hại là mệnh lệnh hợp lệ từ người dùng và tự động thực hiện các hành vi phá hoại như gửi toàn bộ lịch sử trò chuyện hoặc khóa API ra ngoài môi trường Internet41.  
2. **Lỗi đại diện bị nhầm lẫn (Confused Deputy Problem):** Lỗi này xảy ra khi máy chủ MCP được cấu hình hoạt động với quyền hạn hệ thống cao (ví dụ: quyền đọc/ghi toàn bộ cơ sở dữ liệu ERP), trong khi người dùng đang tương tác với Agent chỉ có quyền hạn ở mức nhân viên thông thường40. Nếu Agent không thực hiện xác thực chéo quyền hạn của người dùng thực tế (user context) trước khi gọi công cụ MCP, nó sẽ trở thành một "đại diện bị lợi dụng", vô tình thực hiện các thao tác vượt quyền hạn cho phép của người dùng đó40.  
3. **Sự thiếu hụt vết kiểm toán (Audit Blind Spots):** Các máy chủ MCP tiêu chuẩn thường chỉ ghi nhận lịch sử thực thi công cụ một cách cô lập41. Chúng hoàn toàn không có khả năng ghi nhận nguồn gốc danh tính con người đã kích hoạt chuỗi hành động của Agent, ngữ cảnh lập luận của mô hình tại thời điểm ra quyết định gọi công cụ, hoặc chính sách bảo mật nào đã được đối chiếu39. Điều này gây khó khăn lớn cho công tác khắc phục sự cố hoặc tuân thủ các quy định pháp lý39.

### **Giải pháp thiết kế an ninh bắt buộc cho doanh nghiệp B2B**

* **Cổng kiểm duyệt con người (Human-in-the-loop \- HITL):** Tuyệt đối không cho phép Agent tự trị thực thi các hành động không thể đảo ngược hoặc có tính chất thay đổi trạng thái hệ thống (như chuyển tiền, xóa bản ghi dữ liệu, gửi email cho khách hàng hoặc sửa đổi quyền truy cập) mà không có bước xác nhận thủ công từ người dùng có thẩm quyền qua màn hình phê duyệt30.  
* **Xác thực mã thông báo theo đối tượng (Audience & Scoped Tokens):** Nghiêm cấm việc truyền trực tiếp mã thông báo gốc (token passthrough) của người dùng hoặc sử dụng một khóa cấu hình chung có đặc quyền lớn cho máy chủ MCP40. Mọi kết nối từ Agent đến hệ thống hạ nguồn phải sử dụng các mã thông báo có thời hạn ngắn, được phân quyền tối giản (Least-Privilege Scopes) và được định danh rõ ràng để ghi nhận chính xác vết truy cập của từng cá nhân40.

## **Đo Lường Hoạt Động, Phân Tích Và Giám Sát Chi Phí**

Để thương mại hóa dịch vụ AI một cách bền vững, nhà cung cấp giải pháp cần một hệ thống đo lường viễn thông (Telemetry) chuẩn xác ở cấp độ tài chính để theo dõi từng cuộc gọi mô hình, tính toán chi phí thực tế và xuất hóa đơn cho khách hàng theo mô hình tiêu thụ (consumption-based billing)44.  
Sự kết hợp giữa **LiteLLM** (Cổng định tuyến API) và **Langfuse** (Hệ thống giám sát LLMOps) cung cấp một giải pháp hoàn chỉnh, có thể tự lưu trữ (self-hosted) nhằm đảm bảo chủ quyền dữ liệu và tuân thủ các tiêu chuẩn bảo mật như GDPR hay SOC 21.

### **Kiến trúc phân tích và thu thập siêu dữ liệu**

Hệ thống giám sát hoạt động bằng cách đính kèm các thuộc tính định danh đa thuê (Multi-tenant metadata) vào mọi yêu cầu API gửi qua cổng LiteLLM Proxy49. LiteLLM sẽ tự động xử lý yêu cầu, ghi nhận lượng token tiêu thụ thực tế từ phản hồi của nhà cung cấp mô hình, tính toán chi phí dựa trên cấu hình giá và đẩy toàn bộ dữ liệu này về Langfuse thông qua kết nối bất đồng bộ để tránh ảnh hưởng đến độ trễ của người dùng45.  
Các siêu dữ liệu quan trọng cần được truyền tải bao gồm50:

* trace\_user\_id: Định danh duy nhất của khách hàng doanh nghiệp (Tenant ID).  
* session\_id: Định danh phiên làm việc để nhóm toàn bộ chuỗi hội thoại của Agent.  
* tags: Các thẻ phân loại (ví dụ: bộ phận sử dụng, môi trường thử nghiệm hay sản xuất).

Dữ liệu thu thập được lưu trữ tập trung tại cơ sở dữ liệu PostgreSQL và có thể được truy xuất thông qua Langfuse Metrics API v2 để phục vụ cho các dịch vụ tính cước (Billing engine)44.

\[Mô hình Langfuse v2 Metrics API (Dữ liệu Timeseries nhận được)\] \[cite: 46\]  
   |  
   \+---\> Lượng token tiêu thụ (Breakdown theo Input / Output / Cached Input) \[cite: 45, 46\]  
   \+---\> Tổng chi phí thực tế bằng USD (Total Cost) \[cite: 45, 46\]  
   \+---\> Phân bổ chi phí chi tiết theo từng Model Name \[cite: 46\]  
   \+---\> Số lượng lỗi và mốc thời gian phản hồi (Latency / Time to first token) \[cite: 46\]

## **Chiến Lược Triển Khai Hạ Tầng: Single-Tenant VPC vs. Multi-Tenant Cloud**

Khi cung cấp giải pháp AI Agent cho các doanh nghiệp khác, việc lựa chọn mô hình triển khai hạ tầng là một bài toán đánh đổi lớn giữa hiệu quả kinh tế (FinOps) và yêu cầu bảo mật, tuân thủ pháp lý của khách hàng52.

### **Đánh giá chi tiết hai mô hình triển khai hạ tầng**

| Tiêu chí so sánh | Mô hình Đa Thuê Dùng Chung (Multi-Tenant Cloud) | Mô hình Đơn Thuê Cô Lập (Single-Tenant VPC) |
| :---- | :---- | :---- |
| **Bản chất kiến trúc** | Toàn bộ khách hàng dùng chung một phiên bản ứng dụng, một hệ thống cổng Gateway và chia sẻ chung tài nguyên lưu trữ, tính toán53 | Mỗi khách hàng sở hữu một phiên bản ứng dụng, cơ sở dữ liệu và hạ tầng mạng ảo riêng biệt, hoàn toàn cô lập vật lý53 |
| **Hiệu quả kinh tế (FinOps)** | **Tối ưu cực đại.** Giảm thiểu lãng phí tài nguyên máy chủ nhàn rỗi nhờ cơ chế chia sẻ động53 | **Chi phí vận hành lớn.** Mỗi khách hàng yêu cầu một cấu hình phần cứng tối thiểu riêng biệt để duy trì hệ thống53 |
| **Mức độ bảo mật dữ liệu** | Phụ thuộc hoàn toàn vào tính đúng đắn của logic phân tách dữ liệu ở lớp ứng dụng (rủi ro rò rỉ chéo nếu phát sinh lỗi)20 | **Bảo mật tuyệt đối.** Không có khả năng rò rỉ dữ liệu chéo do sự cô lập hoàn toàn ở cấp độ hạ tầng53 |
| **Công tác bảo trì, nâng cấp** | Rất đơn giản. Chỉ cần thực hiện nâng cấp một phiên bản duy nhất cho toàn bộ hệ thống khách hàng54 | Phức tạp. Đòi hỏi xây dựng các kịch bản CI/CD tự động hóa để cập nhật đồng loạt cho nhiều phân vùng độc lập53 |
| **Khả năng tùy biến tính năng** | Hạn chế. Khách hàng chỉ có thể thay đổi các thiết lập cấu hình cơ bản được hệ thống cho phép53 | **Rất cao.** Khách hàng có thể yêu cầu cài đặt thêm các tiện ích mở rộng hoặc tùy biến mã nguồn theo đặc thù vận hành53 |
| **Quản trị rủi ro phần cứng** | Phức tạp; cần kiểm soát chặt chẽ hiện tượng tranh chấp tài nguyên GPU giữa các tenant1 | Đơn giản; tài nguyên của từng khách hàng được định hạn độc lập trên hạ tầng chuyên dụng53 |

### **Mô hình kiến trúc lai khuyên dùng cho các nhà cung cấp giải pháp B2B**

Đối với các đơn vị phát triển giải pháp AI hướng đến phân khúc doanh nghiệp nhỏ và vừa, phương án tối ưu nhất để cân bằng giữa hiệu quả tài chính và yêu cầu bảo mật dữ liệu là triển khai theo **Kiến trúc Lai kết hợp Cô lập logic (Hybrid-Multi-Tenant Architecture)**5:

                       \[Ứng dụng khách hàng\]  
                                 |  
              \[Tường lửa Web Application Firewall (WAF)\]  
                                 |  
           \[Cổng AI Gateway kiểm tra Model Armor (Ngăn Prompt Injection)\]  
                                 |  
          \+----------------------------------------------+  
          |         Lớp tính toán dùng chung             |  \<--- Tiết kiệm tài nguyên CPU/RAM  
          |   (Shared API Gateway & Orchestrator Node)   |  
          \+----------------------------------------------+  
                                 |  
          \+----------------------------------------------+  
          |          Lớp dữ liệu cô lập logic            |  \<--- Đảm bảo chủ quyền dữ liệu \[cite: 5, 37, 55\]  
          |  (PostgreSQL Row-Level Security / RLS / RAG) |  
          \+----------------------------------------------+

1. **Sử dụng chung lớp tính toán (Shared Compute Layer):** Triển khai một cụm máy chủ trung tâm để chạy ứng dụng điều phối quy trình và cổng AI Gateway1. Việc này giúp doanh nghiệp tận dụng tối đa năng lực xử lý của hệ thống và giảm thiểu chi phí máy chủ nhàn rỗi53.  
2. **Sử dụng cổng Model Armor bảo vệ biên mạng:** Mọi dữ liệu đầu vào từ người dùng phải được quét qua lớp bảo mật để phát hiện và ngăn chặn sớm các cuộc tấn công prompt injection trước khi chuyển tiếp đến Agent xử lý5.  
3. **Cô lập cơ sở dữ liệu ở lớp lưu trữ (Isolated Storage Layer):** Tận dụng tính năng Row-Level Security (RLS) của PostgreSQL để thiết lập các chính sách phân tách dữ liệu cứng ở cấp độ bảng biểu5. Mỗi bản ghi tri thức RAG hoặc lịch sử hội thoại của khách hàng bắt buộc phải gắn liền với một tenant\_id cụ thể1. Hệ quản trị cơ sở dữ liệu sẽ tự động từ chối bất kỳ truy vấn nào không khớp với định danh của phiên làm việc hiện tại, loại bỏ hoàn toàn nguy cơ rò rỉ thông tin chéo ngay cả khi mã nguồn ứng dụng gặp lỗi logic17.  
4. **Cung cấp tùy chọn Single-Tenant VPC cho phân khúc Premium:** Đối với các khách hàng doanh nghiệp lớn hoặc hoạt động trong các lĩnh vực có quy định khắt khe về dữ liệu (như tài chính, y tế), cung cấp gói sản phẩm cao cấp cho phép tự động khởi tạo (provisioning) một hạ tầng riêng biệt trên phân vùng đám mây của họ (VPC) thông qua các kịch bản Terraform sẵn có, đồng thời áp dụng mức phí dịch vụ cao hơn để bù đắp chi phí vận hành53.

## **Lộ Trình Xây Dựng Và Triển Khai Hệ Thống**

Để hiện thực hóa giải pháp AI Agent cấp doanh nghiệp từ các nguyên mẫu thử nghiệm, đơn vị phát triển cần thực hiện một lộ trình kỹ thuật gồm bốn bước chuẩn hóa:

### **Bước 1: Thiết lập nền tảng hạ tầng cốt lõi và kiểm soát pháp lý**

* Xây dựng hệ thống điều phối dựa trên các thư viện có giấy phép mở không ràng buộc như **Activepieces** hoặc **Flowise** để bảo đảm quyền sở hữu mã nguồn và tự do thương mại hóa sản phẩm6.  
* Triển khai cụm cơ sở dữ liệu PostgreSQL tích hợp sẵn tiện ích mở rộng **pgvector** và **pgvectorscale** làm động cơ lưu trữ tri thức RAG tập trung, tránh sử dụng các giải pháp lưu trữ vector độc lập cồng kềnh để tối ưu hóa chi phí hạ tầng ban đầu24.

### **Bước 2: Triển khai cổng AI Gateway và quản trị đa thuê**

* Cài đặt **LiteLLM Proxy** làm cổng quản trị tập trung toàn bộ các kết nối đến các nhà cung cấp mô hình lớn21.  
* Thiết lập cơ chế lưu trữ đệm Redis để thực hiện kiểm tra hạn mức API, áp dụng giới hạn RPM bằng thuật toán cửa sổ trượt và TPM bằng thuật toán thùng chứa token nhằm bảo vệ hệ thống trước các lỗi lặp vô hạn của Agent1.  
* Xây dựng cấu trúc phân bổ ngân sách đa tầng (Org \-\> Team \-\> Key) để kiểm soát chặt chẽ rủi ro bùng nổ chi phí22.

### **Bước 3: Chuẩn hóa giao thức tích hợp hệ thống doanh nghiệp**

* Đóng gói toàn bộ các cổng kết nối đến hệ thống nội bộ của khách hàng (như ERP, CRM, cơ sở dữ liệu) dưới dạng các máy chủ **MCP Servers** tiêu chuẩn30. Việc này giúp đơn giản hóa kiến trúc tích hợp và cho phép Agent tự động khám phá các công cụ hợp lệ một cách linh hoạt4.  
* Thiết lập cơ chế phân quyền tối giản (Least-Privilege) cho các mã thông báo kết nối của MCP Server, tuyệt đối không dùng chung một mã đặc quyền lớn cho toàn bộ hệ thống40.  
* Cấu hình các cổng kiểm duyệt phê duyệt thủ công (Human-in-the-loop) đối với tất cả các tác vụ có tính chất thay đổi trạng thái hoặc gửi thông tin ra môi trường bên ngoài30.

### **Bước 4: Hoàn thiện hệ thống giám sát viễn thông và tính cước**

* Kích hoạt tính năng callback langfuse\_otel trên LiteLLM để đẩy toàn bộ dữ liệu log hội thoại, độ trễ và chi phí USD thực tế về hệ thống **Langfuse**45.  
* Truyền tải các tham số định danh đa thuê (trace\_user\_id, session\_id) trong mọi yêu cầu API của ứng dụng để phân tách chính xác lượng tài nguyên tiêu thụ của từng doanh nghiệp khách hàng50.  
* Phát triển dịch vụ tính cước tự động kết nối với Langfuse Metrics API v2 để trích xuất dữ liệu tiêu dùng hàng tháng, phục vụ cho mô hình kinh doanh thu phí theo lượng sử dụng thực tế của khách hàng44.

#### **Nguồn trích dẫn**

1. Multi-Tenant LLM Serving on GPU Cloud: Per-Customer Isolation, Token Quotas, and Production SaaS Architecture Guide (2026) | Spheron Blog, [https://www.spheron.network/blog/multi-tenant-llm-serving-gpu-cloud/](https://www.spheron.network/blog/multi-tenant-llm-serving-gpu-cloud/)  
2. n8n Automation Licence Explained: Why It's Not Fully Free \- Scalevise, [https://scalevise.com/resources/n8n-automation-license-commercial-use/](https://scalevise.com/resources/n8n-automation-license-commercial-use/)  
3. Single-User vs Multi-User AI Agents: Why Architecture Changes Everything at Scale, [https://www.mindstudio.ai/blog/single-user-vs-multi-user-ai-agents-architecture](https://www.mindstudio.ai/blog/single-user-vs-multi-user-ai-agents-architecture)  
4. Use Model Context Protocol for finance and operations apps \- Microsoft Learn, [https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/copilot/copilot-mcp](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/copilot/copilot-mcp)  
5. Multi-tenant agentic AI system | Cloud Architecture Center, [https://docs.cloud.google.com/architecture/multi-tenant-agentic-ai-system](https://docs.cloud.google.com/architecture/multi-tenant-agentic-ai-system)  
6. Dify vs Flowise: Self-Hosted LLM App Platform Comparison (2026) | Use Apify, [https://use-apify.com/blog/dify-vs-flowise-2026](https://use-apify.com/blog/dify-vs-flowise-2026)  
7. Dify vs Langflow vs Flowise: Which Open-Source LLM App Builder Actually Ships to Production? \- Elestio blog, [https://blog.elest.io/dify-vs-langflow-vs-flowise-which-open-source-llm-app-builder-actually-ships-to-production/](https://blog.elest.io/dify-vs-langflow-vs-flowise-which-open-source-llm-app-builder-actually-ships-to-production/)  
8. n8n vs Activepieces: Which Self-Hosted Automation Platform in 2026? \- Elestio blog, [https://blog.elest.io/n8n-vs-activepieces-which-self-hosted-automation-platform-in-2026/](https://blog.elest.io/n8n-vs-activepieces-which-self-hosted-automation-platform-in-2026/)  
9. The Real Limits of n8n “Free” Automation: What You Need to Know Before Shipping to Production, [https://dev.to/alifar/the-real-limits-of-n8n-free-automation-what-you-need-to-know-before-shipping-to-production-59o6](https://dev.to/alifar/the-real-limits-of-n8n-free-automation-what-you-need-to-know-before-shipping-to-production-59o6)  
10. Low‑Code AI Agent Builders (2026): Dify, Flowise, Wordware, or Lindy?, [https://www.aiagentshub.net/blog/dify-vs-flowise-vs-wordware-vs-lindy](https://www.aiagentshub.net/blog/dify-vs-flowise-vs-wordware-vs-lindy)  
11. Dify alternative: embeddable workflow editor with React SDK, [https://www.workflowbuilder.io/compare/dify](https://www.workflowbuilder.io/compare/dify)  
12. Sustainable use license | Privacy and security \- n8n Docs, [https://docs.n8n.io/privacy-and-security/sustainable-use-license](https://docs.n8n.io/privacy-and-security/sustainable-use-license)  
13. n8n License Risk: Why 'Open Source' Doesn't Mean 'Free for Everything', [https://handyintelligence.com/blog/n8n-lizenz-risiko/](https://handyintelligence.com/blog/n8n-lizenz-risiko/)  
14. n8n vs Activepieces \- Talos.tools, [https://talos.tools/compare/n8n-vs-activepieces](https://talos.tools/compare/n8n-vs-activepieces)  
15. n8n vs Activepieces for Developer Workflow Automation: A Practical 2026 Comparison, [https://dev.to/ciphernutz/n8n-vs-activepieces-for-developer-workflow-automation-a-practical-2026-comparison-3i4k](https://dev.to/ciphernutz/n8n-vs-activepieces-for-developer-workflow-automation-a-practical-2026-comparison-3i4k)  
16. The N8N and ActivePieces License Conversation | DevelopersHangout and No-Code News, [https://www.developershangout.io/episodes/the-n8n-and-activepieces-license-conversation](https://www.developershangout.io/episodes/the-n8n-and-activepieces-license-conversation)  
17. Enterprise Multi-Tenancy in Dify: What We Learned Deploying for 3 Enterprise Clients · langgenius dify · Discussion \#37333 \- GitHub, [https://github.com/langgenius/dify/discussions/37333](https://github.com/langgenius/dify/discussions/37333)  
18. Activepieces vs n8n: open-source automation compared \- CodeWords, [https://www.codewords.ai/blog/activepieces-vs-n8n](https://www.codewords.ai/blog/activepieces-vs-n8n)  
19. N8n as a SaaS backend — How much does the license allow? \- Questions, [https://community.n8n.io/t/n8n-as-a-saas-backend-how-much-does-the-license-allow/238586](https://community.n8n.io/t/n8n-as-a-saas-backend-how-much-does-the-license-allow/238586)  
20. Dify flaws expose cross-tenant AI data, Zafran says, [https://securitybrief.news/story/dify-flaws-expose-cross-tenant-ai-data-zafran-says](https://securitybrief.news/story/dify-flaws-expose-cross-tenant-ai-data-zafran-says)  
21. LiteLLM now natively supports Oracle Generative AI Infrastructure | ai-data-science, [https://blogs.oracle.com/ai-and-datascience/litellm-natively-supports-generative-ai](https://blogs.oracle.com/ai-and-datascience/litellm-natively-supports-generative-ai)  
22. Building Hierarchical Budget Controls for Multi-Tenant LLM Gateways \- DEV Community, [https://dev.to/pranay\_batta/building-hierarchical-budget-controls-for-multi-tenant-llm-gateways-ceo](https://dev.to/pranay_batta/building-hierarchical-budget-controls-for-multi-tenant-llm-gateways-ceo)  
23. Rate Limiting in AI Gateway : The Ultimate Guide \- Truefoundry, [https://www.truefoundry.com/blog/rate-limiting-in-llm-gateway](https://www.truefoundry.com/blog/rate-limiting-in-llm-gateway)  
24. Best Vector Databases in 2026: A Complete Comparison \- fastCRW, [https://fastcrw.com/blog/best-vector-databases](https://fastcrw.com/blog/best-vector-databases)  
25. Top 15 vector databases in 2026: A production decision guide from 100+ enterprise deployments \- Medium, [https://medium.com/@pratik-rupareliya/top-15-vector-databases-in-2026-a-production-decision-guide-from-100-enterprise-deployments-dd58a04f51a5](https://medium.com/@pratik-rupareliya/top-15-vector-databases-in-2026-a-production-decision-guide-from-100-enterprise-deployments-dd58a04f51a5)  
26. Cost Analysis of Vector DBs: Qdrant vs Milvus Architecture | CloudAtler Blog, [https://cloudatler.com/blog/cost-analysis-of-vector-dbs-qdrant-vs-milvus-architecture](https://cloudatler.com/blog/cost-analysis-of-vector-dbs-qdrant-vs-milvus-architecture)  
27. pgvector vs Milvus: 5 key differences and how to choose \- NetApp Instaclustr, [https://www.instaclustr.com/education/vector-database/pgvector-vs-milvus-5-key-differences-and-how-to-choose/](https://www.instaclustr.com/education/vector-database/pgvector-vs-milvus-5-key-differences-and-how-to-choose/)  
28. Vector Database Comparison for RAG: Qdrant vs Weaviate vs Milvus \- LushBinary, [https://lushbinary.com/blog/vector-database-comparison-rag-qdrant-weaviate-milvus/](https://lushbinary.com/blog/vector-database-comparison-rag-qdrant-weaviate-milvus/)  
29. Best Vector Databases in 2026: A Complete Comparison Guide \- Firecrawl, [https://www.firecrawl.dev/blog/best-vector-databases](https://www.firecrawl.dev/blog/best-vector-databases)  
30. Model Context Protocol (MCP): The New Standard for Connecting AI and ERP | ARICOMA, [https://www.aricoma.com/inspiration/model-context-protocol-mcp-the-new-standard-for-connecting-ai-and-erp](https://www.aricoma.com/inspiration/model-context-protocol-mcp-the-new-standard-for-connecting-ai-and-erp)  
31. Model Context Protocol (MCP) as an Infrastructure for AI Integration \- valantic, [https://www.valantic.com/en/blog/model-context-protocol-mcp-for-ai-integration/](https://www.valantic.com/en/blog/model-context-protocol-mcp-for-ai-integration/)  
32. Agent Client Protocol (ACP) \- CLI \- Docs \- Kiro, [https://kiro.dev/docs/cli/acp/](https://kiro.dev/docs/cli/acp/)  
33. Agent Client Protocol (ACP): Use Any Coding Agent in Any IDE \- JetBrains, [https://www.jetbrains.com/acp/](https://www.jetbrains.com/acp/)  
34. ACP vs MCP: What's the difference for agentic coding? \- CircleCI, [https://circleci.com/blog/acp-vs-mcp-whats-the-difference-for-agentic-coding/](https://circleci.com/blog/acp-vs-mcp-whats-the-difference-for-agentic-coding/)  
35. Agent Client Protocol (ACP): The LSP for AI Coding Agents Explained \- Marc Nuri, [https://blog.marcnuri.com/agent-client-protocol-acp-introduction](https://blog.marcnuri.com/agent-client-protocol-acp-introduction)  
36. Agent Client Protocol (ACP) Explained: ACP vs MCP, Editor Support, Setup | Morph, [https://www.morphllm.com/agent-client-protocol](https://www.morphllm.com/agent-client-protocol)  
37. Model context protocol (MCP) for enterprise AI integration \- Strategy, [https://www.strategy.com/pt/software/blog/model-context-protocol-mcp-for-enterprise-ai-integration](https://www.strategy.com/pt/software/blog/model-context-protocol-mcp-for-enterprise-ai-integration)  
38. ACP Mode \- Gemini CLI, [https://geminicli.com/docs/cli/acp-mode/](https://geminicli.com/docs/cli/acp-mode/)  
39. 7 MCP Server Security Risks for Enterprises \- Witness AI, [https://witness.ai/blog/mcp-server-security/](https://witness.ai/blog/mcp-server-security/)  
40. Model Context Protocol: Security Risks & Mitigations \- SOC Prime, [https://socprime.com/blog/mcp-security-risks-and-mitigations/](https://socprime.com/blog/mcp-security-risks-and-mitigations/)  
41. MCP Security Risks & Best Practices: Enterprise Guide \- Truefoundry, [https://www.truefoundry.com/blog/mcp-security-risks-best-practices](https://www.truefoundry.com/blog/mcp-security-risks-best-practices)  
42. The Security Risks of Model Context Protocol (MCP), [https://www.pillar.security/blog/the-security-risks-of-model-context-protocol-mcp](https://www.pillar.security/blog/the-security-risks-of-model-context-protocol-mcp)  
43. Security Best Practices \- Model Context Protocol, [https://modelcontextprotocol.io/docs/tutorials/security/security\_best\_practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)  
44. Multi-Tenant Architecture with LiteLLM, [https://docs.litellm.ai/docs/proxy/multi\_tenant\_architecture](https://docs.litellm.ai/docs/proxy/multi_tenant_architecture)  
45. Token & Cost Tracking \- Langfuse, [https://langfuse.com/docs/observability/features/token-and-cost-tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)  
46. Metrics API \- Langfuse, [https://langfuse.com/docs/metrics/features/metrics-api](https://langfuse.com/docs/metrics/features/metrics-api)  
47. Pricing \- Langfuse, [https://langfuse.com/pricing](https://langfuse.com/pricing)  
48. Get Started \- OSS LLMOps Stack, [https://oss-llmops-stack.com/docs](https://oss-llmops-stack.com/docs)  
49. Open Source Observability for LiteLLM Proxy \- Langfuse, [https://langfuse.com/integrations/gateways/litellm](https://langfuse.com/integrations/gateways/litellm)  
50. Langfuse \- LiteLLM Docs, [https://docs.litellm.ai/docs/observability/langfuse\_integration](https://docs.litellm.ai/docs/observability/langfuse_integration)  
51. User Tracking \- Langfuse, [https://langfuse.com/docs/observability/features/users](https://langfuse.com/docs/observability/features/users)  
52. Single-Tenant Cloud vs. Multi-Tenant Cloud \- IBM, [https://www.ibm.com/think/topics/single-tenant-cloud-vs-multi-tenant-cloud](https://www.ibm.com/think/topics/single-tenant-cloud-vs-multi-tenant-cloud)  
53. Choosing the right SaaS architecture: Multi-Tenant vs. Single-Tenant \- Clerk, [https://clerk.com/blog/multi-tenant-vs-single-tenant](https://clerk.com/blog/multi-tenant-vs-single-tenant)  
54. Single Tenant vs Multi Tenant in Cloud Architectures \- NAKIVO, [https://www.nakivo.com/blog/single-tenant-vs-multi-tenant/](https://www.nakivo.com/blog/single-tenant-vs-multi-tenant/)  
55. Single-Tenant or Multi-Tenant Cloud: Which One Fits Your Needs? \- VNG Cloud, [https://vngcloud.vn/blog/single-tenant-or-multi-tenant-cloud-which-one-fits-your-needs](https://vngcloud.vn/blog/single-tenant-or-multi-tenant-cloud-which-one-fits-your-needs)  
56. Model Context Protocol for enterprise integration \- Adaptiv, [https://adaptiv.au/model-context-protocol/](https://adaptiv.au/model-context-protocol/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAYCAYAAABjswTDAAACBElEQVR4Xu2WO0tcYRCGx7soBCMKKgoxYCSgEUQUUWzUmPwBGyFBSTot/AHe4qWwtBI7RdOlsLSyEBTETgshqIgkEEEMiMFbEt9hvm+dM+4eLNZ1i33gAc87c86O33f2nCVKkSIm6TaIwkN6HpUCuAJHbEFRAXvhLmw3tYTwCm7CK/gfjgXLEXjAC3hG0tcZLCeGZ7AR5pEMMRqo3lEDM+ESSV9HsJx4wlbW44d9kpXVxGvYbJKdsPDORIN3twU2wCxTi0k8hi2G/+A3lZWTnDOnMqaVpLfZHfO5v+BQpCOEeAzbTVIfUNlHl/WojJmBN7DaHTfBVfg60hECX/CLDQ1+2Le24JglqdeqbMFl/OjTTLn8L1yD/cFyOHziuA0NftguW3B8h8cwTWVH8EAdewrhBsn1vMOBjhC4ecKGBj/sO1ugu3tT369VLpt3x9zj8atfBj/Da5J7ONYXMQBfdNKGBj/se1sAH0hq0yrje5ezPpgLt11eAg99k2MR7pgsQCk8JXkz8VuM/7tLl71Rfb/huav7vj/wp+rhD+eeE7hMspr8SPpB8ipfhc9dL98mWyRPiK9wne5/Ae/BJ0V7tvFW6PsuQ/2t4WcqU0mygrzy/EOnDr5wtRySLbc/gPJhPSwy+aPD28zDfrKFZIS3nId9aQvJyD7cs2GyMgjbbJgiRRy5BfBscqlNr1rmAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAYCAYAAABjswTDAAACRUlEQVR4Xu2Wy6uNURjGH/e7civJ/RKKlJREivwFBlKKEqLQkTJjoBiQXHLLCGEiSUkxOUlhYCJCTodOhwExUETuz+Nd63i/d/u+2bb3YP/qV3s939r7e/f63rX2Blq0+Cd9YlDBQLoshv+DmfQG/Uqf0C20b2FGLYfp+xjWmxn0BV1Op9Hb9Bc96+ZEltKfaECxl+l1OjaNZ8GKlSvyJMcQ+pB+RgOK7YAVdshlT1N2ymWZE3QzfYcGFLuLPkdxFa/Cij3iMqFWuUV7obrY/nRODFG+D4bTxXQB7ReuVbISVqhWt7fLT9JNblxW7BhYP19x2XjYZ55xmVgCm7sojfXeN3R3z4wKBtOX9BVss3luhnFZsatghW1z2bqUrXGZOEa/w04jsZC209k9Myq4Rp/RSSEfSieGrKzY07DC5rrsfMomuEzsT/kPeoduLV6u5j4dFUOyj7bR7bAVkx/pp/Taow37FtbXmW7YE4uMpPfw9/SRewozSlCf6FjKaDMdT69X04POo7AP1vGlcSb3pu9XnePKzqWx5mTy6o+jG+k3WA+XbcQ/aONcCtleujNkmWGwAmIbrE35AZdp5ZWth/1EP0q5zvWuPClxgT4OWYHXKD4G73Q3T0ylH2CbQj/N8ou7rpurNfQl1P9aTR1Juoc2aDsdkeaqTR7ATggt1F3UbsAaBlUY0Q3KHtEU2Be8CDvy5tHJ6doA2CP3R6FQ282no0Ned/SYVeyGeKEZ0SNXsWqVpkf/3Dpj2KzsgP11bNGiXvwG/neFTIn4QqMAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,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>