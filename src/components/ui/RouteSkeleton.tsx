/**
 * 라우트 전환 중 뼈대. PHASE 3-6.
 *
 * ■ 왜 필요한가
 * 이 앱은 useSuspenseQuery 를 24곳에서 쓰는데 pendingComponent 가 어느 라우트에도 없었다.
 * SSR 쪽은 router.tsx 의 dehydrate/hydrate 배선으로 재suspend 를 막아 뒀지만, 그건 첫
 * 진입 이야기다. 클라이언트에서 라우트를 옮길 때 loader 가 늦으면(느린 회선, preload 미스)
 * 화면이 그대로 멈춰 있다가 갑자기 바뀐다 —— 사용자에게는 눌린 건지 아닌지가 안 보인다.
 *
 * ■ 상단 바를 같이 그린다
 * pendingComponent 는 라우트 컴포넌트를 통째로 대신한다. 그런데 내비(HomeNav)는 각 페이지
 * 컴포넌트 안에 있어서, 뼈대에 상단 바가 없으면 로딩 동안 내비가 사라졌다가 돌아온다.
 * 높이(82px)와 배경을 맞춰 레이아웃이 튀지 않게 한다.
 *
 * ■ 언제 보이나
 * 라우터 기본값상 로딩이 일정 시간을 넘겨야 나타난다. 빠른 전환에서는 깜빡이지 않는다.
 */

function Bar({ w, h = 14 }: { w: string; h?: number }) {
  return <div className="animate-pulse rounded bg-[#d8dfe9]" style={{ width: w, height: h }} />;
}

export function RouteSkeleton() {
  return (
    <div className="min-h-screen bg-[#070b16]" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">불러오는 중</span>

      {/* 내비 자리 — 높이를 맞춰 두지 않으면 로딩 전후로 화면이 튄다 */}
      <div className="h-[82px] border-b border-[#78a0cd1c] bg-[#070b16]">
        <div className="mx-auto flex h-full max-w-[1360px] items-center gap-14 px-[18px] min-[620px]:px-7">
          <div className="h-5 w-[104px] animate-pulse rounded bg-[#1d2740]" />
          <div className="hidden gap-[26px] min-[620px]:flex">
            {[38, 38, 52, 38, 38, 38].map((w, i) => (
              <div key={i} className="h-3.5 animate-pulse rounded bg-[#1d2740]" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1360px] px-[18px] py-8 min-[620px]:px-7">
        <div className="rounded-[16px] bg-[#e6eaf1] p-6">
          <div className="flex flex-col gap-3">
            <Bar w="180px" h={20} />
            <Bar w="60%" />
            <Bar w="45%" />
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-[12px] border border-[#d8dfe9] bg-white p-4">
                <Bar w="70px" h={11} />
                <div className="mt-3">
                  <Bar w="110px" h={22} />
                </div>
                <div className="mt-2">
                  <Bar w="88px" h={11} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[12px] border border-[#d8dfe9] bg-white p-4">
            <Bar w="140px" h={13} />
            <div className="mt-4 flex flex-col gap-2.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Bar key={i} w={`${92 - i * 7}%`} h={12} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
