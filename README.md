# Math Kids Worker API

API backend trên Cloudflare Workers cho ứng dụng **Toán Thiếu Nhi (Math Kids)** tại `math-kids-api.hocnhe.com`.

## Chức năng cốt lõi

1. **Course (`courses`)**:
   - `GET /v1/courses`: Danh sách khoá học, hỗ trợ tìm kiếm theo từ khoá (`?q=`), lọc theo taxonomy term (`?term_id=`, `?taxonomy=`) và phân trang (`page`, `size`). Kèm theo số lượng bài học và trạng thái học nếu có user token.
   - `GET /v1/courses/:idOrSlug`: Chi tiết khoá học, danh sách chương học, bài học và danh mục taxonomy.
   - `POST /v1/admin/courses`: Tạo khoá học mới (Admin).

2. **Taxonomies (`taxonomies`)**:
   - `GET /v1/taxonomies`: Danh mục phân loại cho khoá học (độ tuổi, chủ đề hình học, số học, tư duy logic, ...).
   - `POST /v1/admin/taxonomies`: Thêm danh mục (Admin).

3. **Lessons (`lessons`)**:
   - `GET /v1/courses/:courseId/lessons`: Danh sách bài học của khoá.
   - `GET /v1/lessons/:lessonId`: Chi tiết bài học.
   - `POST /v1/admin/courses/:courseId/lessons`: Thêm bài học mới (Admin).

4. **Profiles (`profiles`)**:
   - `GET /v1/profiles`: Danh sách hồ sơ học sinh của người dùng (tối đa 3 profile con).
   - `POST /v1/profiles`: Tạo hồ sơ học sinh mới (`name`, `avatar`, `is_default`).
   - `GET /v1/profiles/:profileId`: Chi tiết một hồ sơ học sinh.
   - `PUT /v1/profiles/:profileId`: Cập nhật tên hoặc avatar của hồ sơ.
   - `DELETE /v1/profiles/:profileId`: Xoá hồ sơ học sinh.
   - Hỗ trợ header `X-Profile-ID` hoặc query `?profile_id=` ở các API học tập (`/v1/my/courses`, `/v1/my/lessons/...`).

5. **Learner Courses (`my/courses`)**:
   - `GET /v1/my/courses`: Danh sách khoá học mà người dùng đã đăng ký hoặc yêu thích (`?status=enrolled|favorite`). Kèm tiến độ số bài hoàn thành.
   - `POST /v1/my/courses/:courseId`: Đăng ký tham gia khoá học / đánh dấu yêu thích.
   - `DELETE /v1/my/courses/:courseId`: Huỷ đăng ký khoá học.

6. **Learner Lessons (`my/lessons` & `my/courses/:courseId/lessons`)**:
   - `GET /v1/my/courses/:courseId/lessons`: Lịch sử học tập theo từng bài của khoá học.
   - `POST /v1/my/lessons/:lessonId/progress`: Lưu tiến độ bài học (trạng thái `in_progress` | `completed`, điểm số, số sao đạt được ⭐ 1-3). Tự động cập nhật bài học gần nhất (`last_lesson_id`) của khoá.

7. **Roadmaps & Learner Roadmaps (`roadmaps` & `my/roadmaps`)**:
   - `GET /v1/roadmaps`: Danh sách lộ trình học đề xuất.
   - `GET /v1/roadmaps/:idOrCode`: Chi tiết lộ trình cùng các khoá học theo thứ tự các chặng học và tiến trình của người học (`learner_progress`).
   - `GET /v1/my/roadmaps`: Danh sách các lộ trình người học đang tham gia và trạng thái hoàn thành.
   - `POST /v1/my/roadmaps/:idOrCode/progress`: Cập nhật chặng học hiện tại (`current_step_order`), điểm số (`score`), trạng thái (`completed`), và metadata (`meta`).
   - `POST /v1/admin/roadmaps`: Tạo lộ trình học (Admin).

8. **Storage (`math-bucket`)**:
   - R2 Bucket: `math-bucket` (Public domain: `https://math-bucket.hocnhe.com`).
   - Nội dung môn Toán thiếu nhi (Math Kids) được lưu trữ chuyên biệt trong prefix `kids/*` (ví dụ: `kids/courses/`, `kids/lessons/`, `kids/roadmaps/`, `kids/assets/`).
   - `POST /v1/admin/storage/presign`: Tạo URL presigned PUT để client tải trực tiếp hình ảnh / âm thanh / tài nguyên lên `math-bucket` dưới thư mục `kids/*`.
   - `POST /v1/admin/storage/delete` hoặc `DELETE /v1/admin/storage/delete`: Xoá tài nguyên trong bucket.

## Phát triển & Kiểm thử

```bash
pnpm install
pnpm run test
pnpm exec tsc
```
