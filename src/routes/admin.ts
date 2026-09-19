import { handleCreateCourse, handleGetCourse, handleListCourses } from '../features/courses/handlers.ts';
import { handleCreateLesson, handleGetLesson, handleListLessons } from '../features/lessons/handlers.ts';
import { handleCreateRoadmap, handleGetRoadmap, handleListRoadmaps } from '../features/roadmaps/handlers.ts';
import { handleCreateUploadPresign, handleDeleteStorageAsset } from '../features/storage/handlers.ts';
import {
  handleCreateTaxonomy,
  handleCreateTaxonomyTerm,
  handleDeleteTaxonomy,
  handleDeleteTaxonomyTerm,
  handleGetTaxonomy,
  handleListTaxonomies,
  handleListTaxonomyTerms,
  handleUpdateTaxonomy,
  handleUpdateTaxonomyTerm,
} from '../features/taxonomies/handlers.ts';
import { errorResponse } from '../utils/response.ts';

export async function routeAdminRequest(
  request: Request,
  env: Env,
  origin: string,
  pathname: string
): Promise<Response> {
  const path = pathname.slice('/v1/admin'.length) || '/';

  // Taxonomies
  if (path === '/taxonomies') {
    if (request.method === 'GET') return handleListTaxonomies(env, origin);
    if (request.method === 'POST') return handleCreateTaxonomy(request, env, origin);
  }

  const taxonomyMatch = path.match(/^\/taxonomies\/([^/]+)$/);
  if (taxonomyMatch) {
    if (request.method === 'GET') return handleGetTaxonomy(env, origin, taxonomyMatch[1]);
    if (request.method === 'PUT' || request.method === 'PATCH') return handleUpdateTaxonomy(request, env, origin, taxonomyMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTaxonomy(env, origin, taxonomyMatch[1]);
  }

  // Taxonomy Terms
  if (path === '/taxonomy-terms') {
    if (request.method === 'GET') return handleListTaxonomyTerms(request, env, origin);
  }

  const taxonomyTermDetailMatch = path.match(/^\/taxonomy-terms\/([^/]+)$/);
  if (taxonomyTermDetailMatch) {
    if (request.method === 'PUT' || request.method === 'PATCH') return handleUpdateTaxonomyTerm(request, env, origin, taxonomyTermDetailMatch[1]);
    if (request.method === 'DELETE') return handleDeleteTaxonomyTerm(env, origin, taxonomyTermDetailMatch[1]);
  }

  const taxonomyTermsMatch = path.match(/^\/taxonomies\/([^/]+)\/terms$/);
  if (taxonomyTermsMatch) {
    if (request.method === 'GET') return handleListTaxonomyTerms(request, env, origin, taxonomyTermsMatch[1]);
    if (request.method === 'POST') return handleCreateTaxonomyTerm(request, env, origin, taxonomyTermsMatch[1]);
  }

  // Courses
  if (path === '/courses') {
    if (request.method === 'GET') return handleListCourses(request, env, origin);
    if (request.method === 'POST') return handleCreateCourse(request, env, origin);
  }

  const courseMatch = path.match(/^\/courses\/([^/]+)$/);
  if (courseMatch) {
    if (request.method === 'GET') return handleGetCourse(env, origin, courseMatch[1]);
  }

  // Course Lessons
  const courseLessonsMatch = path.match(/^\/courses\/([^/]+)\/lessons$/);
  if (courseLessonsMatch) {
    if (request.method === 'GET') return handleListLessons(request, env, origin, courseLessonsMatch[1]);
    if (request.method === 'POST') return handleCreateLesson(request, env, origin, courseLessonsMatch[1]);
  }

  const lessonMatch = path.match(/^\/lessons\/([^/]+)$/);
  if (lessonMatch) {
    if (request.method === 'GET') return handleGetLesson(request, env, origin, lessonMatch[1]);
  }

  // Roadmaps
  if (path === '/roadmaps') {
    if (request.method === 'GET') return handleListRoadmaps(env, origin);
    if (request.method === 'POST') return handleCreateRoadmap(request, env, origin);
  }

  const roadmapMatch = path.match(/^\/roadmaps\/([^/]+)$/);
  if (roadmapMatch) {
    if (request.method === 'GET') return handleGetRoadmap(env, origin, roadmapMatch[1]);
  }

  // Storage / Uploads (math-bucket)
  if (path === '/storage/presign' && request.method === 'POST') {
    return handleCreateUploadPresign(request, env, origin);
  }

  if (path === '/storage/delete' && (request.method === 'POST' || request.method === 'DELETE')) {
    return handleDeleteStorageAsset(request, env, origin);
  }

  return errorResponse(404, 'NOT_FOUND', 'Admin endpoint not found', origin);
}
