import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "서비스 약관 — Heart Diary To-Do" };

export default function Terms() {
  return (
    <main className="legal">
      <article>
        <Link href="/" className="link">← Heart Diary To-Do로 돌아가기</Link>
        <h1>서비스 약관</h1>
        <p className="muted">시행일: 2026년 11월 4일</p>

        <h2>1. 서비스 소개</h2>
        <p>
          Heart Diary To-Do(이하 &ldquo;서비스&rdquo;)는 학교 과제로 만든 무료 1인용 Todo 웹앱입니다. Google 계정으로 로그인해 할 일을
          기록하고, 같은 종이 위에 그림과 글을 남기며, 마스코트 토끼의 안내를 받을 수 있습니다.
        </p>

        <h2>2. 이용</h2>
        <ul>
          <li>서비스는 무료이며 별도 회원가입 절차 없이 Google 로그인으로 이용합니다.</li>
          <li>타인의 계정을 쓰거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.</li>
          <li>사용자가 작성한 기록의 권리와 책임은 사용자에게 있습니다.</li>
        </ul>

        <h2>3. 서비스의 한계</h2>
        <ul>
          <li>과제용 서비스로, 예고 없이 기능이 바뀌거나 운영이 중단될 수 있습니다.</li>
          <li>마감 알림은 페이지를 열어 둔 동안에만 표시되며, 알림이 누락될 수 있습니다. 중요한 일정은 다른 수단으로도 관리해 주세요.</li>
          <li>서비스는 데이터 보존을 보장하지 않으며, 이로 인한 손해에 대해 책임지지 않습니다.</li>
        </ul>

        <h2>4. 개인정보</h2>
        <p>
          개인정보 처리는 <Link href="/privacy" className="link">개인정보처리방침</Link>을 따릅니다.
        </p>

        <h2>5. 문의</h2>
        <p>문의는 Google 로그인 동의 화면의 개발자 지원 이메일로 보내 주세요.</p>
      </article>
    </main>
  );
}
