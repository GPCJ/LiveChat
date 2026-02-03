const nicknameForm = document.querySelector('.nickname-input'); // 닉네임 입력 form
const nickname = document.querySelector('#nickname'); // 닉네임 입력
const chatroom = document.querySelector('.chat-container');
const roomNickname = document.querySelector('.user-nickname'); // 채팅방에 닉네임 표기 span
const closeBtn = document.querySelector('.close-btn'); // 나가기 버튼
const chatInput = document.querySelector('#chat'); // 채팅 입력
const chatInputForm = document.querySelector('.chat-input'); // 채팅 전송 Form
const chatInputBtn = chatInputForm.querySelector('button'); // 채팅 전송 버튼
const loadingLayer = document.querySelector('#loading-layer'); // 로딩 스피너
const chatDeleteBtn = document.querySelector('.message-delete-btn');
const chatList = document.querySelector('.chat-content');
let isPolling = true; // 폴링 ON/OFF 스위치 역할
let pollingId = null; // 폴링에 들어가는 setInterval을 멈추는데 필요한 interval ID
let lastMessageId = null; // 가장 마지막에 작성된 채팅의 ID를 저장

// 닉네임 입력, 저장 기능
nicknameForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const nicknameValue = nickname.value.trim(); // 앞뒤 공백 제거, (my)닉네임

  try {
    // 입력이 공백이면 false이기에 not연산자에 의해 true가 되어 에러 발생 -> catch로 넘어감
    if (!nicknameValue) throw new Error('닉네임을 입력하세요');
    localStorage.setItem('userNickname', nicknameValue);
    // console.log(`환영합니다! ${nicknameValue}님!`);
    // 닉네임이 입력 성공하면 닉네임 입력 UI는 숨기고 채팅방 UI를 표시
    chatroom.classList.remove('hidden');
    nicknameForm.classList.add('hidden');
    // 채팅방 상단에 내 닉네임 표시
    roomNickname.textContent = nicknameValue;
    isPolling = true; // 채팅방을 재입장 시 폴링 작동(채팅방을 나갈 시 isPolling이 false인 상태로 유지되어 다시 입장 했을 때 폴링이 작동하지 않는 문제 해결)
    loadChatHistory(nicknameValue); // 채팅 불러오기, 작성한 닉네임 파라미터로 보냄
  } catch (error) {
    alert(error.message);
    nickname.focus(); // 다시입력을 위한 포커스
  }
});

// 채팅 내역 불러오기 함수 (GET)
async function loadChatHistory(myNickname) {
  // 아직 채팅을 불러오기 않아 null이면 스피너 표시
  if (!lastMessageId) {
    loadingLayer.classList.remove('hidden');
  }

  try {
    const response = await fetch('http://54.180.25.65:3030/api/messages');
    // 통신 실패로 response.ok가 false 반환하면 에러 메시지와 에러 반환
    // -> throw로 에러를 반환하면 프로그램 전체가 멈추지만 return은 이번 호촐에 대한 함수 실행만 끝내고 다음 호출을 기다리는 상태가 되기에 return으로 변경
    if (!response.ok) return;
    // 불러온 정보 JSON으로 받기
    const messages = await response.json();
    const messageArrays = messages.data;
    lastMessageId = messageArrays[messageArrays.length - 1].id; // 채팅 내역 배열의 마지막 요소의 ID
    console.log(lastMessageId);

    startPolling(myNickname);
    if (response.status === 404) {
      // 404 뜨면 에러 메세지와 시도한 URL을 표시
      console.error('주소를 다시 확인하세요! 현재 요청 주소:', response.url);
      return;
    }

    renderMessages(messages, myNickname); // 채팅이 담긴 객체, 처음에 작성한 닉네임
  } catch (error) {
    console.error('오류:', error);
  } finally {
    setTimeout(() => {
      loadingLayer.classList.add('hidden');
    }, 500);
  }
}

// 채팅 입력 기능(채팅이 전송 되기 전까지 다음 전송을 못하게 버튼을 비활성화 해야 하기에 await을 사용해야함 그렇기에 async도 추가)
chatInputForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const chatValue = chatInput.value.trim(); // 앞뒤 공백 제거
  const userNickname = localStorage.getItem('userNickname');
  const chatObj = {
    // 혹시나 value가 문자열이 아니라서 400 에러가 발생 하는건가? 해서 백틱을 사용함. 하지만 역시나 의미 없었었다. JSON 형식으로 변환할 때 같은 작업을 진행하기에 소용은 없어 보였지만 해당 에러가 전송 포맷을 맞췄는데도 발생해서 지푸라기 잡는 심정으로 백틱을 사용함
    // 해결 -> POST 시에 headers에 오타가 있었음
    content: `${chatValue}`,
    nickname: `${userNickname}`,
  };

  try {
    // 공백 방지 처리
    if (!chatValue) throw new Error('채팅을 입력하세요');
    chatInputBtn.disabled = true;
    chatInputBtn.textContent = '...';
    await chatPOST(chatObj);
    // localStorage.setItem('localUserChat', chatValue);
  } catch (error) {
    alert(error.message);
    chatInput.focus(); // 다시입력을 위한 포커스
  } finally {
    // 전송 버튼 상태 원상복구
    setTimeout(() => {
      chatInputBtn.disabled = false;
      chatInputBtn.textContent = '전송';
      chatInput.focus();
    }, 500);
  }
});

// 채팅 POST 함수 (chat = POST 보낼 정보)
async function chatPOST(chat) {
  try {
    const response = await fetch('http://54.180.25.65:3030/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chat),
    });

    // 저장 성공 여부 확인 및 입력창 초기화
    if (response.ok) {
      console.log('저장 성공!');
      chatInput.value = '';
    } else {
      // 저장 실패는 else로 그 외는 에러는 catch로 확인
      console.error('저장 실패:', response.status);
      console.log(chat);
    }
  } catch (error) {
    console.error('네트워크 오류:', error);
  }
}

// // 삭제 버튼 이벤트 리스너
// chatDeleteBtn.addEventListener('click', (e) => {
//   e.preventDefault();

//   if (e.target.classList.contains('message-delete-btn')) {
//     const messageWrapper = e.target.closest('.message-wrapper');
//     const messageId = messageWrapper.dataset.id;
//     const myNickname = localStorage.getItem('userNickname');

//     // 삭제 의사 재확인
//     if (confirm('정말 삭제하시겠습니까?')) {
//       const success = chatDELETE(messageId, myNickname);

//       // 삭제 확정 실행
//       if (success) {
//         messageWrapper.remove();
//       } else {
//         alert('본인만 삭제 가능하거나 서버 오류가 발생했습니다.');
//       }
//     }
//   }
// });
// 원래 삭제 버튼을 기준으로 만들려고 했으나 삭제 버튼은 채팅 정보를 불러와야 생성되는 HTML코드 포함되어 있기에 급한 대로 이벤트 위임 방식으로 구현

chatList.addEventListener('click', async (e) => {
  if (e.target.classList.contains('message-delete-btn')) {
    e.preventDefault();

    const messageWrapper = e.target.closest('.message-wrapper');
    const messageId = messageWrapper.dataset.id;
    const myNickname = localStorage.getItem('userNickname');

    if (confirm('정말 삭제하시겠습니까?')) {
      const success = await chatDELETE(messageId, myNickname);
      if (success) {
        messageWrapper.remove();
        console.log('삭제 성공');
      } else {
        alert('본인만 삭제 가능하거나 서버 오류가 발생했습니다.');
      }
    }
  }
});

// 채팅 삭제(Delete) 함수
async function chatDELETE(messageId, nickname) {
  try {
    const response = await fetch(
      `http://54.180.25.65:3030/api/messages/${messageId}?nickname=${nickname}`,
      {
        method: 'DELETE',
      },
    );
    return response.ok;
  } catch (error) {
    console.error('삭제 요청 중 오류: ', error);
    return false;
  }
}

// 채팅 내역 화면에 렌더링 하는 함수
function renderMessages(messages, myNickname) {
  const messageArrays = messages.data;

  // 닉네임으로 내 채팅인지 상대 채팅인지 구분해서 화면에 채팅 표시
  const chatHTML = messageArrays // 채팅 데이터 배열
    .map((msg) => {
      // 내 이번에 표시할 채팅이 내 닉네임과 동일한지 판단
      const isMine = msg.nickname === myNickname;
      // isMine boolean 여부에 따라 sideClass에 mine 할당 할지 other 할당 할지 판단
      const sideClass = isMine ? 'mine' : 'other';

      return `
      <div class="message-wrapper ${sideClass}" data-id="${msg.id}">
      ${!isMine ? `<span class="user-name">${msg.nickname}</span>` : `<span style="text-align: end;">나</span>`}
        <div class="message-content">
          <div class="bubble">${msg.content}</div>
          ${!isMine ? '' : `<button class="message-delete-btn">x</button>`}
        </div>
        <span class="timestamp">${formatTime(msg.createdAt)}</span>
      </div>
      `;
    })
    .join(''); // map메서드 다 돌아간 결과물에 join메서드 돌려서 채팅 하나마다 ' , ' 달리는거 삭제

  // 기존에 작성된 HTML 채팅 내역을 새로 그리지 않고 새로운 채팅을 추가
  chatList.insertAdjacentHTML('beforeend', chatHTML);
  chatList.scrollTop = chatList.scrollHeight; // 최신 채팅으로 스크롤
}

// 폴링 기능 수행 함수
async function startPolling(myNickname) {
  // isPolling(폴링 스위치)이 true면 함수 종료, false면 밑에 코드 실행(처음에는 if 조건 괄호에 not없이 사용했는데 이러니까 true 시에 폴링 OFF, false 시에 ON이여서 헷갈릴 것 같아 not을 추가함)
  if (!isPolling) return;

  pollingId = setInterval(async () => {
    console.log('폴링 중...');
    try {
      const response = await fetch(
        `http://54.180.25.65:3030/api/messages/new?after=${lastMessageId}`,
      );
      // 통신 실패 시 return
      if (!response.ok) return;
      const messages = await response.json();
      const messageArrays = messages.data;
      // 새로운 채팅이 없을 시 없다고 알려주고, 그렇지 않을 시 추가된 채팅의 마지막 ID를 저장(이 코드가 없어서 새로운 채팅이 생기면 if문 조건이 계속 false가 되어 '폴링 중...' 만 출력했음)
      if (messageArrays.length === 0) {
        console.log('새로운 채팅이 없습니다.');
      } else {
        lastMessageId = messageArrays[messageArrays.length - 1].id;
      }

      if (response.status === 404) {
        // 404 뜨면 에러 메세지와 시도한 URL을 표시
        console.error('주소를 다시 확인하세요! 현재 요청 주소:', response.url);
        return;
      }

      renderMessages(messages, myNickname); // 채팅이 담긴 객체, 처음에 작성한 닉네임
    } catch (error) {
      console.error('오류:', error);
    }
  }, 3000);
}
async function stopPolling() {
  isPolling = false; // 폴링 스위치 OFF
  if (!isPolling) {
    clearInterval(pollingId);
    pollingId = null; // 폴링 중단 후 ID 초기화
    console.log('폴링 중단');
  }
}

// 채팅 작성 시간 포맷팅 함수
function formatTime(dateString) {
  const date = new Date(dateString);

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit', // 2자릿수 표기
    minute: '2-digit',
    hour12: false,
  });
}

// 채팅방 나가기 버튼 기능 부여
closeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  chatroom.classList.add('hidden');
  nicknameForm.classList.remove('hidden');
  stopPolling();
});

// Todo : 폴링 실행 시 새로운 채팅이 없어도 스크롤이 강제로 최신 채팅 쪽으로 조정되는 문제 해결
