// Supabase 연결 테스트 (Node.js 환경)
import('node-fetch').then(({ default: fetch }) => {
  global.fetch = fetch;

  const SUPABASE_URL = 'https://nxpmqoglznvabcsdjsxy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cG1xb2dsem52YWJjc2Rqc3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTk2MzksImV4cCI6MjEwMDYzNTYzOX0.QfO21vYArfBWryyq67yewDxyGw6ThntbXesg2Nh46Tg';

  async function test() {
    try {
      console.log('테스트 시작...');
      
      // Events 테이블 테스트
      console.log('\n1. Events 테이블 조회 테스트');
      const eventsRes = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      const events = await eventsRes.json();
      console.log(`✓ Events: ${Array.isArray(events) ? `${events.length}개` : 'ERROR'}`);
      console.log('Events:', events);

      // Tickets 테이블 테스트
      console.log('\n2. Tickets 테이블 조회 테스트');
      const ticketsRes = await fetch(`${SUPABASE_URL}/rest/v1/tickets`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      const tickets = await ticketsRes.json();
      console.log(`✓ Tickets: ${Array.isArray(tickets) ? `${tickets.length}개` : 'ERROR'}`);
      console.log('Tickets:', tickets);

      console.log('\n✓ 모든 테스트 완료!');
    } catch (err) {
      console.error('✗ 에러:', err.message);
    }
  }

  test();
}).catch(err => {
  console.log('fetch 라이브러리 로드 실패, curl로 테스트');
});
