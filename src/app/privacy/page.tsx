import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침 — Heart Diary To-Do" };

export default function Privacy() {
  return (
    <main className="legal">
      <article>
        <Link href="/" className="link">← Heart Diary To-Do로 돌아가기</Link>
        <h1>개인정보처리방침</h1>
        <p className="muted">시행일: 2026년 11월 4일</p>

        <p>
          Heart Diary To-Do(이하 &ldquo;서비스&rdquo;)는 학교 과제로 만든 1인용 비공개 Todo 웹앱입니다. 서비스는 아래와 같이 최소한의 정보만
          수집하고, 할 일 기록을 보여 주는 목적 외에는 쓰지 않습니다.
        </p>

        <h2>1. 수집하는 정보</h2>
        <ul>
          <li>Google 로그인 시 Google이 제공하는 계정 정보: 이메일 주소, 이름, 프로필 사진 주소, Google 계정 고유 식별자</li>
          <li>사용자가 직접 입력한 정보: 할 일 제목·마감 시각·완료 여부, Todo 종이 위에 그린 펜 획과 글상자 내용</li>
          <li>설정: 토끼 목소리 켜기/끄기</li>
        </ul>
        <p>위치, 연락처, 결제 정보는 수집하지 않으며 광고·분석 도구를 쓰지 않습니다.</p>

        <h2>2. 이용 목적</h2>
        <ul>
          <li>로그인한 사용자를 구분하고, 그 사용자의 할 일과 낙서를 저장·복원</li>
          <li>마스코트 토끼가 저장된 할 일을 바탕으로 안내 문구를 보여 주는 것</li>
        </ul>

        <h2>3. 보관 장소와 공유</h2>
        <ul>
          <li>데이터는 Neon PostgreSQL(AWS 싱가포르 리전)에 저장되고, 서비스는 Vercel에서 운영됩니다.</li>
          <li>각 사용자의 기록은 로그인한 본인만 조회·수정·삭제할 수 있습니다.</li>
          <li>수집한 정보를 제3자에게 판매하거나 제공하지 않습니다.</li>
        </ul>

        <h2>4. 보관 기간과 삭제</h2>
        <p>
          할 일은 화면에서 언제든 직접 삭제할 수 있습니다. 계정과 모든 기록의 삭제를 원하면 Google 로그인 동의 화면에 표시되는 개발자 지원
          이메일로 요청해 주세요. 요청을 받으면 해당 계정의 정보를 지체 없이 삭제합니다. 과제 기간이 끝나 서비스를 종료할 때도 저장된 정보를
          삭제합니다.
        </p>

        <h2>5. 문의</h2>
        <p>개인정보 관련 문의는 Google 로그인 동의 화면의 개발자 지원 이메일로 보내 주세요.</p>
      </article>
    </main>
  );
}
