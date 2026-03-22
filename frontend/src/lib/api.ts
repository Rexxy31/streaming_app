import { createClient } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
const AUTH_HEADER_TTL_MS = 15_000;

export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/admin/health`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

let cachedHeaders: HeadersInit | null = null;
let cachedHeadersAt = 0;

async function getAuthHeaders(): Promise<HeadersInit> {
  if (cachedHeaders && Date.now() - cachedHeadersAt < AUTH_HEADER_TTL_MS) {
    return cachedHeaders;
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };

  cachedHeaders = headers;
  cachedHeadersAt = Date.now();
  return headers;
}

async function authedFetch(input: string, init?: RequestInit) {
  const headers = await getAuthHeaders();
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...headers,
    },
  });
}

async function authedJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(input, init);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export interface CourseDTO {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  totalLectures: number;
  completedLectures: number;
  progressPercentage: number;
  bestNextLessonIndex?: number | null;
  bestNextLectureId?: string | null;
  bestNextLectureTitle?: string | null;
  almostFinished?: boolean;
  sections: SectionDTO[] | null;
}

export interface SectionDTO {
  id: string;
  title: string;
  sortOrder: number;
  lectures: LectureDTO[];
}

export interface LectureDTO {
  id: string;
  title: string;
  sortOrder: number;
  durationSeconds: number | null;
  subtitleStatus?: string;
  hasSubtitle?: boolean;
  completed: boolean;
  lastPositionSeconds: number;
}

export interface ResumeWatchingDTO {
  courseId: string;
  courseTitle: string;
  lectureId: string;
  lectureTitle: string;
  lastPositionSeconds: number;
  completed: boolean;
  recommendationType?: string;
}

export interface StreamUrlDTO {
  url: string;
  subtitleUrl: string | null;
  subtitleFormat: string | null;
  expiresInMinutes: number;
}

export interface RecentLectureDTO {
  courseId: string;
  courseTitle: string;
  lectureId: string;
  lectureTitle: string;
  sectionTitle?: string;
  updatedAt: string;
  progressSeconds: number;
  completed: boolean;
  progressPercentage: number;
}

export interface LectureNoteDTO {
  id: string;
  timeSeconds: number;
  text: string;
  tags: string[];
  highlightColor: string | null;
  createdAt: string;
}

export interface LectureBookmarkDTO {
  id: string;
  timeSeconds: number;
  label: string;
  tags: string[];
  highlightColor: string | null;
  createdAt: string;
}

export interface TranscriptCueDTO {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface LessonSearchResultDTO {
  courseId: string;
  courseTitle: string;
  sectionId: string;
  sectionTitle: string;
  lectureId: string;
  lectureTitle: string;
  matchedInTitle: boolean;
  matchedInTranscript: boolean;
  lastPositionSeconds: number;
  completed: boolean;
  transcriptMatches: TranscriptCueDTO[];
}

export interface CourseSearchResultDTO {
  query: string;
  lessons: LessonSearchResultDTO[];
}

export interface StudyGuideItemDTO {
  type: "note" | "bookmark";
  lectureId: string;
  lectureTitle: string;
  sectionTitle: string;
  timeSeconds: number;
  primaryText: string;
  secondaryText: string;
  tags: string[];
  highlightColor: string | null;
  createdAt: string;
}

export interface StudyGuideDTO {
  courseId: string;
  courseTitle: string;
  totalNotes: number;
  totalBookmarks: number;
  items: StudyGuideItemDTO[];
}

export interface ContinueLearningItemDTO {
  label: string;
  courseId: string;
  courseTitle: string;
  lectureId: string;
  lectureTitle: string;
  progressSeconds: number;
  progressPercentage: number;
  completed: boolean;
}

export interface ContinueLearningDTO {
  pickUpWhereYouLeftOff: ContinueLearningItemDTO | null;
  almostFinished: ContinueLearningItemDTO | null;
  bestNextLessons: ContinueLearningItemDTO[];
}

export interface LectureHealthDTO {
  lectureId: string;
  lectureTitle: string;
  sectionTitle: string;
  videoPresent: boolean;
  subtitlePresent: boolean;
  subtitleStatus: string;
  durationSeconds: number | null;
}

export interface CourseHealthDTO {
  courseId: string;
  courseTitle: string;
  totalLectures: number;
  lecturesWithVideo: number;
  lecturesWithSubtitles: number;
  missingVideoCount: number;
  missingSubtitleCount: number;
  status: string;
  lectureDiagnostics: LectureHealthDTO[];
}

export interface DashboardDTO {
  courses: CourseDTO[];
  recentLectures: RecentLectureDTO[];
  favoriteCourseIds: string[];
  continueLearning: ContinueLearningDTO;
}

export interface AdminHealthSummaryDTO {
  totalCourses: number;
  totalLectures: number;
  totalMissingVideos: number;
  totalMissingSubtitles: number;
  courses: CourseHealthDTO[];
}

export interface SyncProgress {
  active: boolean;
  status: string;
  current: number;
  total: number;
  percentage: number;
};



export function fetchCourses(): Promise<CourseDTO[]> {
  return authedJson<CourseDTO[]>(`${API_URL}/courses`);
}

export function fetchCourse(id: string): Promise<CourseDTO> {
  return authedJson<CourseDTO>(`${API_URL}/courses/${id}`);
}

export function fetchStreamUrl(lectureId: string): Promise<StreamUrlDTO> {
  return authedJson<StreamUrlDTO>(`${API_URL}/lectures/${lectureId}/stream-url`);
}

const subtitleCache = new Map<string, string>();

export async function fetchLectureSubtitle(lectureId: string): Promise<string | null> {
  if (subtitleCache.has(lectureId)) {
    return subtitleCache.get(lectureId)!;
  }
  const res = await authedFetch(`${API_URL}/lectures/${lectureId}/subtitles`);
  if (res.status === 204) return null;
  if (!res.ok) return null;
  const text = await res.text();
  if (text) subtitleCache.set(lectureId, text);
  return text;
}

export async function updateProgress(
  lectureId: string,
  lastPositionSeconds: number,
  completed: boolean
): Promise<void> {
  await authedFetch(`${API_URL}/progress`, {
    method: "PUT",
    body: JSON.stringify({ lectureId, lastPositionSeconds, completed }),
  });
}

export function scanS3(): Promise<Record<string, unknown>> {
  return authedJson<Record<string, unknown>>(`${API_URL}/admin/scan-s3`, {
    method: "POST",
  });
}

export function refreshMetadata(): Promise<Record<string, unknown>> {
  return authedJson<Record<string, unknown>>(`${API_URL}/admin/refresh-metadata`, {
    method: "POST",
  });
}

export function fetchScanStatus(): Promise<SyncProgress> {
  return authedJson<SyncProgress>(`${API_URL}/admin/scan-status`);
}

export async function fetchResumeWatching(): Promise<ResumeWatchingDTO | null> {
  const res = await authedFetch(`${API_URL}/courses/resume`, { cache: "no-store" });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error("Failed to fetch resume watching data");
  return res.json();
}

export async function updateLectureDuration(lectureId: string, durationSeconds: number): Promise<void> {
  await authedFetch(`${API_URL}/lectures/${lectureId}/duration`, {
    method: "POST",
    body: JSON.stringify(durationSeconds),
  });
}

export function fetchFavoriteCourseIds(): Promise<string[]> {
  return authedJson<string[]>(`${API_URL}/learning/favorites`, { cache: "no-store" });
}

export async function updateFavoriteCourse(courseId: string, favorite: boolean): Promise<string[]> {
  const data = await authedJson<{ favoriteCourseIds: string[] }>(`${API_URL}/learning/favorites/${courseId}`, {
    method: "PUT",
    body: JSON.stringify({ favorite }),
  });
  return data.favoriteCourseIds || [];
}

export function fetchRecentLectures(limit = 12): Promise<RecentLectureDTO[]> {
  return authedJson<RecentLectureDTO[]>(`${API_URL}/learning/recent?limit=${limit}`, { cache: "no-store" });
}

export function fetchLectureNotes(lectureId: string): Promise<LectureNoteDTO[]> {
  return authedJson<LectureNoteDTO[]>(`${API_URL}/learning/lectures/${lectureId}/notes`, { cache: "no-store" });
}

export function createLectureNote(
  lectureId: string,
  payload: { timeSeconds: number; text: string; tags?: string[]; highlightColor?: string | null }
): Promise<LectureNoteDTO> {
  return authedJson<LectureNoteDTO>(`${API_URL}/learning/lectures/${lectureId}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLectureNote(
  noteId: string,
  payload: { timeSeconds: number; text: string; tags?: string[]; highlightColor?: string | null }
): Promise<LectureNoteDTO> {
  return authedJson<LectureNoteDTO>(`${API_URL}/learning/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLectureNote(noteId: string): Promise<void> {
  const res = await authedFetch(`${API_URL}/learning/notes/${noteId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete lecture note");
}

export function fetchLectureBookmarks(lectureId: string): Promise<LectureBookmarkDTO[]> {
  return authedJson<LectureBookmarkDTO[]>(`${API_URL}/learning/lectures/${lectureId}/bookmarks`, { cache: "no-store" });
}

export function createLectureBookmark(
  lectureId: string,
  payload: { timeSeconds: number; label: string; tags?: string[]; highlightColor?: string | null }
): Promise<LectureBookmarkDTO> {
  return authedJson<LectureBookmarkDTO>(`${API_URL}/learning/lectures/${lectureId}/bookmarks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLectureBookmark(
  bookmarkId: string,
  payload: { timeSeconds: number; label: string; tags?: string[]; highlightColor?: string | null }
): Promise<LectureBookmarkDTO> {
  return authedJson<LectureBookmarkDTO>(`${API_URL}/learning/bookmarks/${bookmarkId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLectureBookmark(bookmarkId: string): Promise<void> {
  const res = await authedFetch(`${API_URL}/learning/bookmarks/${bookmarkId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete lecture bookmark");
}

export function searchLessons(query: string, courseId?: string): Promise<CourseSearchResultDTO> {
  const params = new URLSearchParams({ q: query });
  if (courseId) params.set("courseId", courseId);
  return authedJson<CourseSearchResultDTO>(`${API_URL}/learning/search?${params.toString()}`, {
    cache: "no-store",
  });
}

export function fetchStudyGuide(courseId: string): Promise<StudyGuideDTO> {
  return authedJson<StudyGuideDTO>(`${API_URL}/learning/courses/${courseId}/study-guide`, {
    cache: "no-store",
  });
}

export function fetchContinueLearning(): Promise<ContinueLearningDTO> {
  return authedJson<ContinueLearningDTO>(`${API_URL}/learning/continue-learning`, {
    cache: "no-store",
  });
}

export function fetchCourseHealth(): Promise<AdminHealthSummaryDTO> {
  return authedJson<AdminHealthSummaryDTO>(`${API_URL}/admin/course-health`, {
    cache: "no-store",
  });
}

export function fetchDashboard(): Promise<DashboardDTO> {
  return authedJson<DashboardDTO>(`${API_URL}/learning/dashboard`);
}

export async function generateSubtitles(courseId?: string): Promise<{ message: string }> {
  const url = courseId
    ? `${API_URL}/admin/generate-subtitles?courseId=${courseId}`
    : `${API_URL}/admin/generate-subtitles`;
  return authedJson<{ message: string }>(url, { method: "POST" });
}
