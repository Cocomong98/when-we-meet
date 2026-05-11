# When We Meet — Logic & Design Spec

## 1) 기능 목적
- 팀 단위 일정 조율 서비스.
- 기간(시작~종료) 내에서 팀원별 가능/불가능 날짜를 선택.
- 선택 모드(`안되는 날` / `되는 날`)에 따라 전체 교집합 결과를 계산.

## 2) 상태 모델
- `step: 1 | 2`
  - `1`: 기간 설정 화면
  - `2`: 팀원 조율 화면
- `range: DateRange | undefined`
  - 초기 기간 선택값 (`react-day-picker` range 모드).
- `rangeOpen: boolean`
  - 기간 선택 캘린더 팝오버 열림/닫힘.
- `inputMode: "AVAILABLE" | "UNAVAILABLE"`
  - `AVAILABLE`: 되는 날 입력 모드
  - `UNAVAILABLE`: 안되는 날 입력 모드
- `members: Member[]`
  - `Member = { id, name, selectedDates, collapsed }`
  - `selectedDates`: `YYYY-MM-DD` 로컬 문자열 배열
  - `collapsed`: 해당 팀원 입력 완료(카드 닫힘) 상태
- `activeMemberId: string | null`
  - 현재 편집 중인 팀원 식별자

## 3) 날짜 처리 규칙
- 모든 날짜는 로컬 기준 처리.
- 파싱: `parseInputDate("YYYY-MM-DD") => new Date(year, month-1, day)`
- 포맷: `formatLocalDate(Date) => "YYYY-MM-DD"`
- 기간 배열 생성: `buildDateRange(startDate, endDate)`로 `dateRange` 생성.
- UTC(`toISOString`) 기반 변환 미사용.

## 4) 핵심 계산 로직
- `dateRange`: 선택한 시작/종료일 사이 전체 날짜 목록.
- `finalAvailableDates`:
  - `UNAVAILABLE` 모드: 모든 팀원이 **선택하지 않은 날짜**만 통과.
  - `AVAILABLE` 모드: 모든 팀원이 **선택한 날짜**만 통과.
- 주중/주말 일괄 선택(`bulkToggleByDayType`):
  - 대상 날짜 집합(주중/주말)을 구한 뒤 토글 동작.
  - 대상이 전부 선택되어 있으면 일괄 해제, 아니면 일괄 선택.

## 5) 화면/UX 흐름

### Step 1. 기간 설정
- 상단 트리거 버튼 클릭 시 달력 팝오버 오픈.
- `DayPicker(mode="range", numberOfMonths=2)` 사용.
- 기간 선택 후 `범위 설정 완료` 클릭 시 Step 2 이동.

### Step 2. 팀원 조율
- 좌측
  - 팀원 추가/삭제.
  - 모두 가능한 날짜 리스트 출력.
- 우측
  - 팀원 목록(이름 수정 가능).
  - 활성 팀원 단일 달력 표시(`DayPicker(mode="multiple", numberOfMonths=2)`).
  - `주중 일괄`, `주말 일괄`, `선택 완료` 제공.
  - `선택 완료` 클릭 시 해당 팀원 카드 접힘(`collapsed=true`).
- 모든 팀원 `collapsed=true`이면 요약 화면으로 전환.
  - 각 팀원 카드에 `수정` 버튼 제공.
  - `수정` 클릭 시 해당 팀원 카드 재오픈 및 편집 재진입.

## 6) 달력 UI 일관성
- Step 1/Step 2 모두 동일한 커스텀 day 셀 렌더링 사용.
- day 셀 내부 표기:
  - 1행: `n일`
  - 2행: 요일 (`일~토`)
- `.shared-calendar` 클래스 기반 중앙 정렬/공통 테마 적용.

## 7) 스타일 시스템 개요
- 파일: `App.css`
- 구조:
  - 레이아웃: `header`, `layout`, `sidebar`, `content`
  - 패널: `panel`, `result-panel`, `calendar-panel`, `summary-panel`
  - 팀원: `member-list`, `member-tile`, `summary-card`
  - 달력: `.shared-calendar`, `.member-calendar`, `.day-cell-content`
- 결과 날짜 표시:
  - 과밀 pill 나열 제거.
  - 카드형 리스트(`.date-list`, `.date-list-item`)로 정돈.

## 8) 외부 라이브러리
- `react-day-picker`: 기간/다중 날짜 선택 캘린더
- `lucide-react`: 캘린더 아이콘

## 9) 파일 기준
- 로직: `App.tsx`
- 스타일: `App.css`
- 엔트리: `main.tsx`
- 빌드/도구:
  - `package.json`
  - `tsconfig.json`
  - `vite.config.ts`

