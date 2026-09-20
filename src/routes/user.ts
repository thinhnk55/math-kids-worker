import { handleGetCourse, handleListCourses } from '../features/courses/handlers.ts';
import { handleEnrollCourse, handleListMyCourses, handleUnenrollCourse } from '../features/learner-courses/handlers.ts';
import { handleListLearnerLessons, handleSaveLessonProgress } from '../features/learner-lessons/handlers.ts';
import { handleGetLesson, handleListLessons } from '../features/lessons/handlers.ts';
import {
  handleGetRoadmap,
  handleListMyRoadmaps,
  handleListRoadmaps,
  handleSaveRoadmapProgress,
} from '../features/roadmaps/handlers.ts';
import {
  handleGetTaxonomy,
  handleListTaxonomies,
  handleListTaxonomyTerms,
} from '../features/taxonomies/handlers.ts';
import { validateProfileId } from '../utils/profile.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string,
  userIdString: string,
  userRole?: string,
  profilesInToken?: number[]
): Promise<Response> {
  const path = pathname.slice('/v1'.length) || '/';
  const userId = Number.parseInt(userIdString, 10);

  if (Number.isNaN(userId)) {
    return errorResponse(401, 'UNAUTHORIZED', 'ID người dùng không hợp lệ', origin);
  }

  // Kiểm tra profile_id từ query param (?profile_id=...)
  // Nếu có param profile_id thì phải nằm trong profiles của JWT payload.
  // Không có thì profileId = null và không cần kiểm tra.
  const profileValidation = validateProfileId(request, profilesInToken, origin);
  if (!profileValidation.ok) {
    return profileValidation.response;
  }
  const profileId = profileValidation.profileId;

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'math-kids-worker', userId, userRole }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // 1. Taxonomies & Taxonomy Terms (chỉ đọc danh mục & thuật ngữ)
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

  // 2. Courses (Public / Search / Filter)
  if (path === '/courses' && request.method === 'GET') {
    return handleListCourses(request, env, origin, userId, profileId);
  }

  const courseMatch = path.match(/^\/courses\/([^/]+)$/);
  if (courseMatch && request.method === 'GET') {
    return handleGetCourse(env, origin, courseMatch[1], userId, profileId);
  }

  const courseLessonsMatch = path.match(/^\/courses\/([^/]+)\/lessons$/);
  if (courseLessonsMatch && request.method === 'GET') {
    return handleListLessons(request, env, origin, courseLessonsMatch[1], userId, profileId);
  }

  const lessonMatch = path.match(/^\/lessons\/([^/]+)$/);
  if (lessonMatch && request.method === 'GET') {
    return handleGetLesson(request, env, origin, lessonMatch[1], userId, profileId);
  }

  // 3. Learner Courses (Khoá học của tôi / Đăng ký / Huỷ)
  if (path === '/my/courses') {
    if (request.method === 'GET') return handleListMyCourses(request, env, origin, userId, profileId);
  }

  const enrollCourseMatch = path.match(/^\/my\/courses\/([^/]+)$/);
  if (enrollCourseMatch) {
    if (request.method === 'POST' || request.method === 'PUT') {
      return handleEnrollCourse(request, env, origin, userId, enrollCourseMatch[1], profileId);
    }
    if (request.method === 'DELETE') {
      return handleUnenrollCourse(request, env, origin, userId, enrollCourseMatch[1], profileId);
    }
  }

  // 4. Learner Lessons (Lịch sử học tập & Lưu tiến độ bài)
  const learnerCourseLessonsMatch = path.match(/^\/my\/courses\/([^/]+)\/lessons$/);
  if (learnerCourseLessonsMatch && request.method === 'GET') {
    return handleListLearnerLessons(request, env, origin, userId, learnerCourseLessonsMatch[1], profileId);
  }

  const saveLessonProgressMatch = path.match(/^\/my\/lessons\/([^/]+)\/progress$/);
  if (saveLessonProgressMatch && (request.method === 'POST' || request.method === 'PUT')) {
    return handleSaveLessonProgress(request, env, origin, userId, saveLessonProgressMatch[1], profileId);
  }

  // 5. Roadmaps & Learner Roadmaps (Lộ trình học & Tiến trình lộ trình)
  if (path === '/my/roadmaps' && request.method === 'GET') {
    return handleListMyRoadmaps(request, env, origin, userId, profileId);
  }

  const saveRoadmapProgressMatch = path.match(/^\/my\/roadmaps\/([^/]+)\/progress$/);
  if (saveRoadmapProgressMatch && (request.method === 'POST' || request.method === 'PUT')) {
    return handleSaveRoadmapProgress(request, env, origin, userId, saveRoadmapProgressMatch[1], profileId);
  }

  if (path === '/roadmaps' && request.method === 'GET') {
    return handleListRoadmaps(env, origin);
  }

  const roadmapMatch = path.match(/^\/roadmaps\/([^/]+)$/);
  if (roadmapMatch && request.method === 'GET') {
    return handleGetRoadmap(env, origin, roadmapMatch[1], userId, profileId);
  }

  return errorResponse(404, 'NOT_FOUND', 'User endpoint not found', origin);
}
