import { handleGetCourse, handleListCourses } from '../features/courses/handlers.ts';
import { handleEnrollCourse, handleListMyCourses, handleUnenrollCourse } from '../features/learner-courses/handlers.ts';
import { handleListLearnerLessons, handleSaveLessonProgress } from '../features/learner-lessons/handlers.ts';
import { handleGetLesson, handleListLessons } from '../features/lessons/handlers.ts';
import {
  handleCreateProfile,
  handleDeleteProfile,
  handleGetProfile,
  handleListProfiles,
  handleUpdateProfile,
} from '../features/profile/handlers.ts';
import { handleGetRoadmap, handleListRoadmaps } from '../features/roadmaps/handlers.ts';
import {
  handleGetTaxonomy,
  handleListTaxonomies,
  handleListTaxonomyTerms,
} from '../features/taxonomies/handlers.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string,
  userIdString: string,
  userRole?: string
): Promise<Response> {
  const path = pathname.slice('/v1'.length) || '/';
  const profileIdHeader = request.headers.get('X-Profile-ID');
  const userId = Number.parseInt(userIdString, 10);

  if (Number.isNaN(userId)) {
    return errorResponse(401, 'UNAUTHORIZED', 'ID người dùng không hợp lệ', origin);
  }

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'math-kids-worker', userId, userRole }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // 1. Profiles (Danh sách, Tạo, Chi tiết, Cập nhật, Xoá)
  if (path === '/profiles') {
    if (request.method === 'GET') return handleListProfiles(env, origin, userId);
    if (request.method === 'POST') return handleCreateProfile(request, env, origin, userId);
  }

  const profileMatch = path.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch) {
    if (request.method === 'GET') return handleGetProfile(env, origin, userId, profileMatch[1]);
    if (request.method === 'PUT' || request.method === 'POST') {
      return handleUpdateProfile(request, env, origin, userId, profileMatch[1]);
    }
    if (request.method === 'DELETE') return handleDeleteProfile(env, origin, userId, profileMatch[1]);
  }

  // 2. Taxonomies & Taxonomy Terms (chỉ đọc danh mục & thuật ngữ)
  if (path === '/taxonomies' && request.method === 'GET') {
    return handleListTaxonomies(env, origin);
  }

  const taxonomyMatch = path.match(/^\/taxonomies\/([^/]+)$/);
  if (taxonomyMatch && request.method === 'GET') {
    return handleGetTaxonomy(env, origin, taxonomyMatch[1]);
  }

  if (path === '/taxonomy-terms' && request.method === 'GET') {
    return handleListTaxonomyTerms(request, env, origin);
  }

  const taxonomyTermsMatch = path.match(/^\/taxonomies\/([^/]+)\/terms$/);
  if (taxonomyTermsMatch && request.method === 'GET') {
    return handleListTaxonomyTerms(request, env, origin, taxonomyTermsMatch[1]);
  }

  // 3. Courses (Public / Search / Filter)
  if (path === '/courses' && request.method === 'GET') {
    return handleListCourses(request, env, origin, userId, profileIdHeader || undefined);
  }

  const courseMatch = path.match(/^\/courses\/([^/]+)$/);
  if (courseMatch && request.method === 'GET') {
    return handleGetCourse(env, origin, courseMatch[1], userId, profileIdHeader || undefined);
  }

  const courseLessonsMatch = path.match(/^\/courses\/([^/]+)\/lessons$/);
  if (courseLessonsMatch && request.method === 'GET') {
    return handleListLessons(request, env, origin, courseLessonsMatch[1], userId, profileIdHeader);
  }

  const lessonMatch = path.match(/^\/lessons\/([^/]+)$/);
  if (lessonMatch && request.method === 'GET') {
    return handleGetLesson(request, env, origin, lessonMatch[1], userId, profileIdHeader);
  }

  // 4. Learner Courses (Khoá học của tôi / Đăng ký / Huỷ)
  if (path === '/my/courses') {
    if (request.method === 'GET') return handleListMyCourses(request, env, origin, userId, profileIdHeader);
  }

  const enrollCourseMatch = path.match(/^\/my\/courses\/([^/]+)$/);
  if (enrollCourseMatch) {
    if (request.method === 'POST' || request.method === 'PUT') {
      return handleEnrollCourse(request, env, origin, userId, enrollCourseMatch[1], profileIdHeader);
    }
    if (request.method === 'DELETE') {
      return handleUnenrollCourse(request, env, origin, userId, enrollCourseMatch[1], profileIdHeader);
    }
  }

  // 5. Learner Lessons (Lịch sử học tập & Lưu tiến độ bài)
  const learnerCourseLessonsMatch = path.match(/^\/my\/courses\/([^/]+)\/lessons$/);
  if (learnerCourseLessonsMatch && request.method === 'GET') {
    return handleListLearnerLessons(request, env, origin, userId, learnerCourseLessonsMatch[1], profileIdHeader);
  }

  const saveLessonProgressMatch = path.match(/^\/my\/lessons\/([^/]+)\/progress$/);
  if (saveLessonProgressMatch && (request.method === 'POST' || request.method === 'PUT')) {
    return handleSaveLessonProgress(request, env, origin, userId, saveLessonProgressMatch[1], profileIdHeader);
  }

  // 6. Roadmaps (Lộ trình học)
  if (path === '/roadmaps' && request.method === 'GET') {
    return handleListRoadmaps(env, origin);
  }

  const roadmapMatch = path.match(/^\/roadmaps\/([^/]+)$/);
  if (roadmapMatch && request.method === 'GET') {
    return handleGetRoadmap(env, origin, roadmapMatch[1], userId, profileIdHeader || undefined);
  }

  return errorResponse(404, 'NOT_FOUND', 'User endpoint not found', origin);
}
