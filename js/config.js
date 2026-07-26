// Supabase 설정
export const SUPABASE_URL = 'https://rakpyhrvrrnwoqnvhjfo.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJha3B5aHJ2cnJud29xbnZoamZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNjI2MzQsImV4cCI6MjEwMDYzODYzNH0.K0rpBs97I5cqpy266hv8E0YPxnPNzcClSCvQ5POC1vc';

// 모임 공용 암호. 필요 시 이 값만 바꾸면 됩니다.
export const APP_PASSWORD = '0302';
export const ADMIN_PASSWORD = '03020302';

// KBO 팀 목록 및 홈 구장
export const TEAMS = [
  { name: '두산', stadium: '잠실야구장' },
  { name: '삼성', stadium: '대구삼성라이온즈파크' },
  { name: 'LG', stadium: '잠실야구장' },
  { name: '한화', stadium: '대전한화생명이글스파크' },
  { name: '키움', stadium: '고척돔' },
  { name: 'KIA', stadium: '광주기아챔피언스필드' },
  { name: 'KT', stadium: '수원KT위즈파크' },
  { name: 'SSG', stadium: '인천SSG랜더스필드' },
  { name: '롯데', stadium: '부산롯데자이언츠파크' },
  { name: 'NC', stadium: '창원NC파크' },
];

export function getStadium(teamName) {
  return TEAMS.find((t) => t.name === teamName)?.stadium || '';
}
