import { handleGetCourse, handleListCourses } from '../features/courses/handlers.ts';
import { handleEnrollCourse, handleListMyCourses, handleUnenrollCourse } from '../features/learner-courses/handlers.ts';
import { handleListLearnerLessons, handleSaveLessonProgress } from '../features/learner-lessons/handlers.ts';
import { handleGetLesson, handleListLessons } from '../features/lessons/handlers.ts';
import { handleGetProfile, handleUpdateProfile } from '../features/profile/handlers.ts';
import { handleGetRoadmap, handleListRoadmaps } from '../features/roadmaps/handlers.ts';
import { handleListTaxonomies } from '../features/taxonomies/handlers.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string,
  userId: string,
  userRole?: string
): Promise<Response> {
  const path = pathname.slice('/v1'.length) || '/';

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'math-kids-worker', userId, userRole }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // 1. Profile
  if (path === '/profile') {
    if (request.method === 'GET') return handleGetProfile(env, origin, userId);
    if (request.method === 'PUT' || request.method === 'POST') return handleUpdateProfile(request, env, origin, userId);
  }

  // 2. Taxonomies (chỉ đọc danh mục)
  if (path === '/taxonomies' && request.method === 'GET') {
    return handleListTaxonomies(request, env, origin);
  }

  // 3. Courses (Public / Search / Filter)
  if (path === '/courses' && request.method === 'GET') {
    return handleListCourses(request, env, origin, userId);
  }

  const courseMatch = path.match(/^\/courses\/([^/]+)$/);
  if (courseMatch && request.method === 'GET') {
    return handleGetCourse(env, origin, courseMatch[1], userId);
  }

  const courseLessonsMatch = path.match(/^\/courses\/([^/]+)\/lessons$/);
  if (courseLessonsMatch && request.method === 'GET') {
    return handleListLessons(env, origin, courseLessonsMatch[1], userId);
  }

  const lessonMatch = path.match(/^\/lessons\/([^/]+)$/);
  if (lessonMatch && request.method === 'GET') {
    return handleGetLesson(env, origin, lessonMatch[1], userId);
  }

  // 4. Learner Courses (Khoá học của tôi / Đăng ký / Huỷ)
  if (path === '/my/courses') {
    if (request.method === 'GET') return handleListMyCourses(request, env, origin, userId);
  }

  const enrollCourseMatch = path.match(/^\/my\/courses\/([^/]+)$/);
  if (enrollCourseMatch) {
    if (request.method === 'POST' || request.method === 'PUT') {
      return handleEnrollCourse(request, env, origin, userId, enrollCourseMatch[1]);
    }
    if (request.method === 'DELETE') {
      return handleUnenrollCourse(env, origin, userId, enrollCourseMatch[1]);
    }
  }

  // 5. Learner Lessons (Lịch sử học tập & Lưu tiến độ bài)
  const learnerCourseLessonsMatch = path.match(/^\/my\/courses\/([^/]+)\/lessons$/);
  if (learnerCourseLessonsMatch && request.method === 'GET') {
    return handleListLearnerLessons(env, origin, userId, learnerCourseLessonsMatch[1]);
  }

  const saveLessonProgressMatch = path.match(/^\/my\/lessons\/([^/]+)\/progress$/);
  if (saveLessonProgressMatch && (request.method === 'POST' || request.method === 'PUT')) {
    return handleSaveLessonProgress(request, env, origin, userId, saveLessonProgressMatch[1]);
  }

  // 6. Roadmaps (Lộ trình học)
  if (path === '/roadmaps' && request.method === 'GET') {
    return handleListRoadmaps(env, origin);
  }

  const roadmapMatch = path.match(/^\/roadmaps\/([^/]+)$/);
  if (roadmapMatch && request.method === 'GET') {
    return handleGetRoadmap(env, origin, roadmapMatch[1], userId);
  }

  return errorResponse(404, 'NOT_FOUND', 'User endpoint not found', origin);
}
