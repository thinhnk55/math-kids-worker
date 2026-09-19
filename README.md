# Math Kids Worker API

API backend trên Cloudflare Workers cho ứng dụng **Toán Thiếu Nhi (Math Kids)** tại `math-kids-api.hocnhe.com`.

## Chức năng cốt lõi

1. **Course (`courses`)**:
   - `GET /v1/courses`: Danh sách khoá học, hỗ trợ tìm kiếm theo từ khoá (`?q=`), lọc theo độ tuổi (`?age_group=`), cấp độ (`?level=`), danh mục (`?taxonomy_id=`) và phân trang (`page`, `size`). Kèm theo số lượng bài học và trạng thái học nếu có user token.
   - `GET /v1/courses/:idOrSlug`: Chi tiết khoá học, danh sách chương học, bài học và danh mục taxonomy.
   - `POST /v1/admin/courses`: Tạo khoá học mới (Admin).

2. **Taxonomies (`taxonomies`)**:
   - `GET /v1/taxonomies`: Danh mục phân loại cho khoá học (độ tuổi, chủ đề hình học, số học, tư duy logic, ...).
   - `POST /v1/admin/taxonomies`: Thêm danh mục (Admin).

3. **Lessons (`lessons`)**:
   - `GET /v1/courses/:courseId/lessons`: Danh sách bài học của khoá.
   - `GET /v1/lessons/:lessonId`: Chi tiết bài học.
   - `POST /v1/admin/courses/:courseId/lessons`: Thêm bài học mới (Admin).

4. **Profile (`profile`)**:
   - `GET /v1/profile`: Xem hồ sơ học tập của bé (nickname, cấp lớp, avatar, năm sinh).
   - `PUT /v1/profile`: Cập nhật hồ sơ học tập.

5. **Learner Courses (`my/courses`)**:
   - `GET /v1/my/courses`: Danh sách khoá học mà người dùng đã đăng ký hoặc yêu thích (`?status=enrolled|favorite`). Kèm tiến độ số bài hoàn thành.
   - `POST /v1/my/courses/:courseId`: Đăng ký tham gia khoá học / đánh dấu yêu thích.
   - `DELETE /v1/my/courses/:courseId`: Huỷ đăng ký khoá học.

6. **Learner Lessons (`my/lessons` & `my/courses/:courseId/lessons`)**:
   - `GET /v1/my/courses/:courseId/lessons`: Lịch sử học tập theo từng bài của khoá học.
   - `POST /v1/my/lessons/:lessonId/progress`: Lưu tiến độ bài học (trạng thái `in_progress` | `completed`, điểm số, số sao đạt được ⭐ 1-3). Tự động cập nhật bài học gần nhất (`last_lesson_id`) của khoá.

7. **Roadmaps (`roadmaps`)**:
   - `GET /v1/roadmaps`: Danh sách lộ trình học đề xuất.
   - `GET /v1/roadmaps/:idOrCode`: Chi tiết lộ trình cùng các khoá học theo thứ tự các chặng học.
   - `POST /v1/admin/roadmaps`: Tạo lộ trình học (Admin).

## Phát triển & Kiểm thử

```bash
pnpm install
pnpm run test
pnpm exec tsc
```
