// NOL티켓 모바일티켓 카톡 메시지 원문 파싱.
// 여러 건이 이어 붙여져 있어도 global 매칭으로 한 번에 추출한다.
//
// 기대 포맷:
// [NOL티켓 모바일티켓이 도착했어요]
// {등록자이름}님이 모바일티켓을 보냈어요!
// - 받은티켓: {경기명}
// - PIN번호: {PIN}
// - 티켓받기: {URL}

const NOL_PATTERN =
  /([^\n]+?)\s*님이\s*모바일\s*티켓을\s*보냈어요\s*!?[\s\S]*?받은\s*티켓\s*:\s*([^\n]+)[\s\S]*?PIN\s*번호\s*:\s*([^\n]+)[\s\S]*?티켓\s*받기\s*:\s*(\S+)/g;

export function parseNolMessages(text) {
  if (!text) return [];
  const results = [];
  const regex = new RegExp(NOL_PATTERN);
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({
      registeredBy: match[1].trim(),
      eventNameRef: match[2].trim(),
      pin: match[3].trim(),
      url: match[4].trim(),
    });
  }
  return results;
}
