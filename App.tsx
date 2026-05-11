import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { DateRange, DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import "./App.css";

type Role = "HOST" | "MEMBER";
type AppView = "HOME" | "CREATE" | "JOIN" | "ROOM";
type Member = { id: string; name: string; selectedDates: string[] };
type Room = {
    code: string;
    hostKey: string;
    startDate: string;
    endDate: string;
    createdAt: number;
    members: Member[];
};
type Session = { roomCode: string; role: Role; hostKey?: string; memberId?: string };

const STORAGE_KEY = "when-we-meet-rooms-v2";
const KOREAN_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const parseInputDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateString: string) => {
    const parsed = parseInputDate(dateString);
    return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일 (${KOREAN_DAYS[parsed.getDay()]}요일)`;
};

const buildDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return [];
    const dates: string[] = [];
    const current = parseInputDate(startDate);
    const last = parseInputDate(endDate);
    while (current <= last) {
        dates.push(formatLocalDate(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

const calculateFinalDates = (dateRange: string[], members: Member[]) => {
    if (members.length === 0) return [];
    const selectedSets = members.map((member) => new Set(member.selectedDates));
    return dateRange.filter((date) => selectedSets.every((selectedSet) => selectedSet.has(date)));
};

const readRooms = (): Record<string, Room> => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw) as Record<string, Room>;
    } catch {
        return {};
    }
};

const writeRooms = (rooms: Record<string, Room>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
};

const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

const DayCellContent = ({ date }: { date: Date }) => {
    return (
        <span className="day-cell-content">
            <strong>{date.getDate()}일</strong>
            <small>{KOREAN_DAYS[date.getDay()]}</small>
        </span>
    );
};

export default function App() {
    const [view, setView] = useState<AppView>("HOME");
    const [rooms, setRooms] = useState<Record<string, Room>>(() => readRooms());
    const [session, setSession] = useState<Session | null>(null);

    const [createRange, setCreateRange] = useState<DateRange | undefined>();
    const [createOpen, setCreateOpen] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createdCode, setCreatedCode] = useState("");

    const [joinCode, setJoinCode] = useState("");
    const [joinName, setJoinName] = useState("");
    const [joinError, setJoinError] = useState("");

    useEffect(() => {
        writeRooms(rooms);
    }, [rooms]);

    useEffect(() => {
        const sync = () => setRooms(readRooms());
        const id = window.setInterval(sync, 1200);
        return () => window.clearInterval(id);
    }, []);

    const currentRoom = session ? rooms[session.roomCode] : undefined;
    const roomDateRange = useMemo(
        () => (currentRoom ? buildDateRange(currentRoom.startDate, currentRoom.endDate) : []),
        [currentRoom],
    );
    const finalDates = useMemo(
        () => (currentRoom ? calculateFinalDates(roomDateRange, currentRoom.members) : []),
        [currentRoom, roomDateRange],
    );

    const currentMember =
        session?.role === "MEMBER" && currentRoom
            ? currentRoom.members.find((member) => member.id === session.memberId) ?? null
            : null;

    const createRoom = () => {
        if (!createRange?.from || !createRange?.to) {
            setCreateError("기간을 선택하세요.");
            return;
        }
        const startDate = formatLocalDate(createRange.from);
        const endDate = formatLocalDate(createRange.to);
        const dateRange = buildDateRange(startDate, endDate);
        if (dateRange.length > 31) {
            setCreateError("최대 31일까지만 설정할 수 있습니다.");
            return;
        }
        let code = randomCode();
        while (rooms[code]) code = randomCode();
        const hostKey = crypto.randomUUID();
        const nextRoom: Room = {
            code,
            hostKey,
            startDate,
            endDate,
            createdAt: Date.now(),
            members: [],
        };
        setRooms((prev) => ({ ...prev, [code]: nextRoom }));
        setSession({ roomCode: code, role: "HOST", hostKey });
        setCreatedCode(code);
        setCreateError("");
        setView("ROOM");
    };

    const joinRoom = () => {
        const code = joinCode.trim();
        const name = joinName.trim();
        if (!code || !name) {
            setJoinError("방 번호와 이름을 입력하세요.");
            return;
        }
        const room = rooms[code];
        if (!room) {
            setJoinError("유효하지 않은 방 번호입니다.");
            return;
        }
        const memberId = crypto.randomUUID();
        const nextRoom: Room = {
            ...room,
            members: [...room.members, { id: memberId, name, selectedDates: [] }],
        };
        setRooms((prev) => ({ ...prev, [code]: nextRoom }));
        setSession({ roomCode: code, role: "MEMBER", memberId });
        setJoinError("");
        setView("ROOM");
    };

    const updateMemberDates = (dates: Date[] | undefined) => {
        if (!session || session.role !== "MEMBER" || !currentRoom || !currentMember) return;
        const nextDates = (dates ?? []).map((date) => formatLocalDate(date));
        setRooms((prev) => {
            const room = prev[session.roomCode];
            if (!room) return prev;
            return {
                ...prev,
                [session.roomCode]: {
                    ...room,
                    members: room.members.map((member) =>
                        member.id === session.memberId ? { ...member, selectedDates: nextDates } : member,
                    ),
                },
            };
        });
    };

    const leaveRoom = () => {
        setSession(null);
        setView("HOME");
    };

    const isHost =
        session?.role === "HOST" &&
        currentRoom &&
        session.hostKey &&
        currentRoom.hostKey === session.hostKey;

    if (view === "HOME") {
        return (
            <div className="page landing">
                <section className="card hero-card">
                    <h1>When We Meet</h1>
                    <p>팀원이 가능한 날짜를 모아 가장 좋은 일정을 찾습니다.</p>
                    <div className="action-row">
                        <button className="primary-button" type="button" onClick={() => setView("CREATE")}>
                            방 만들기
                        </button>
                        <button className="secondary-button" type="button" onClick={() => setView("JOIN")}>
                            방 입장하기
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    if (view === "CREATE") {
        const startDate = createRange?.from ? formatLocalDate(createRange.from) : "";
        const endDate = createRange?.to ? formatLocalDate(createRange.to) : "";
        const dateRange = createRange?.from && createRange?.to ? buildDateRange(startDate, endDate) : [];

        return (
            <div className="page setup-page">
                <section className="card setup-card">
                    <h2>모임 방 생성</h2>
                    <p className="helper-text">생성 전에 투표 기간을 먼저 설정합니다.</p>
                    <button type="button" className="range-trigger" onClick={() => setCreateOpen((prev) => !prev)}>
                        <Calendar size={18} />
                        <span>{startDate && endDate ? `${startDate} ~ ${endDate}` : "기간 선택"}</span>
                    </button>
                    {createOpen && (
                        <div className="calendar-popover">
                            <DayPicker
                                mode="range"
                                selected={createRange}
                                onSelect={(range) => {
                                    setCreateRange(range);
                                    setCreateError("");
                                }}
                                numberOfMonths={2}
                                className="shared-calendar"
                                components={{ DayContent: DayCellContent }}
                            />
                        </div>
                    )}
                    {dateRange.length > 0 && (
                        <div className="range-summary">
                            <div>
                                <span className="muted-text">시작</span>
                                <strong>{startDate}</strong>
                            </div>
                            <div>
                                <span className="muted-text">종료</span>
                                <strong>{endDate}</strong>
                            </div>
                            <div>
                                <span className="muted-text">총 기간</span>
                                <strong>{dateRange.length}일</strong>
                            </div>
                        </div>
                    )}
                    {createError && <p className="warning-text">{createError}</p>}
                    <div className="action-row">
                        <button className="primary-button" type="button" onClick={createRoom}>
                            방 생성
                        </button>
                        <button className="secondary-button" type="button" onClick={() => setView("HOME")}>
                            취소
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    if (view === "JOIN") {
        return (
            <div className="page setup-page">
                <section className="card setup-card">
                    <h2>방 입장</h2>
                    <p className="helper-text">방 번호를 모르면 입장할 수 없습니다.</p>
                    <label className="label" htmlFor="join-code">
                        방 번호
                    </label>
                    <input
                        id="join-code"
                        className="text-input"
                        value={joinCode}
                        onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="예: 482391"
                    />
                    <label className="label" htmlFor="join-name">
                        이름
                    </label>
                    <input
                        id="join-name"
                        className="text-input"
                        value={joinName}
                        onChange={(event) => setJoinName(event.target.value)}
                        placeholder="참여자 이름"
                    />
                    {joinError && <p className="warning-text">{joinError}</p>}
                    <div className="action-row">
                        <button className="primary-button" type="button" onClick={joinRoom}>
                            입장
                        </button>
                        <button className="secondary-button" type="button" onClick={() => setView("HOME")}>
                            취소
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    if (!currentRoom || !session) {
        return (
            <div className="page landing">
                <section className="card hero-card">
                    <h1>방 정보를 찾을 수 없습니다.</h1>
                    <button className="primary-button" type="button" onClick={() => setView("HOME")}>
                        홈으로
                    </button>
                </section>
            </div>
        );
    }

    return (
        <div className="page app-page">
            <header className="header">
                <div className="header-inner">
                    <div>
                        <h1>When We Meet</h1>
                        <p className="muted-text">방 번호: {currentRoom.code}</p>
                    </div>
                    <button className="secondary-button" type="button" onClick={leaveRoom}>
                        나가기
                    </button>
                </div>
            </header>

            <main className="layout">
                <aside className="sidebar">
                    <section className="panel">
                        <h2>방 정보</h2>
                        <p className="helper-text">
                            투표 기간: {currentRoom.startDate} ~ {currentRoom.endDate}
                        </p>
                        <p className="helper-text">참여 인원: {currentRoom.members.length}명</p>
                        {createdCode && isHost && <p className="helper-text">공유 번호: {createdCode}</p>}
                    </section>

                    <section className="panel result-panel">
                        <h2>모두 가능한 날짜</h2>
                        {isHost ? (
                            finalDates.length > 0 ? (
                                <div className="date-list">
                                    {finalDates.map((date) => (
                                        <div key={date} className="date-list-item">
                                            <strong>{formatDisplayDate(date)}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>아직 모든 팀원이 공통으로 가능한 날짜가 없습니다.</p>
                                </div>
                            )
                        ) : (
                            <div className="empty-state">
                                <p>팀원은 날짜 선택만 가능합니다.</p>
                                <p className="helper-text">방장이 최종 가능한 날짜를 확인합니다.</p>
                            </div>
                        )}
                    </section>
                </aside>

                <section className="content">
                    {isHost ? (
                        <section className="card calendar-panel">
                            <h3>참여자 현황</h3>
                            <div className="member-list">
                                {currentRoom.members.map((member) => (
                                    <article key={member.id} className="member-tile">
                                        <div className="member-tile-row">
                                            <span>{member.name.slice(0, 1) || "?"}</span>
                                            <div className="member-tile-main">
                                                <strong>{member.name}</strong>
                                                <p className="helper-text">가능 날짜 {member.selectedDates.length}개 선택</p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <section className="card calendar-panel">
                            <h3>가능한 날짜 선택</h3>
                            <p className="helper-text">
                                선택 가능 범위: {currentRoom.startDate} ~ {currentRoom.endDate}
                            </p>
                            <p className="helper-text">선택한 날짜: {currentMember?.selectedDates.length ?? 0}개</p>
                            <DayPicker
                                mode="multiple"
                                selected={(currentMember?.selectedDates ?? []).map((date) => parseInputDate(date))}
                                onSelect={updateMemberDates}
                                fromDate={parseInputDate(currentRoom.startDate)}
                                toDate={parseInputDate(currentRoom.endDate)}
                                disabled={(date) => !roomDateRange.includes(formatLocalDate(date))}
                                numberOfMonths={2}
                                className="shared-calendar member-calendar"
                                components={{ DayContent: DayCellContent }}
                            />
                        </section>
                    )}
                </section>
            </main>
        </div>
    );
}
