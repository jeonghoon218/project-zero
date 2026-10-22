[README.md](https://github.com/user-attachments/files/33813915/README.md)
# PROJECT ZERO - 협동 3D 방탈출 스타터

Node.js 20+ 필요.

## 로컬 실행

```sh
npm install
npm start
```

브라우저에서 http://localhost:3000 열기. 브라우저 3개(또는 서로 다른 기기 3개)로 접속해서 녹색 발판에 모이면 한 팀으로 이동.

## Render 배포

GitHub 저장소에 파일 업로드 후 Render → New → Web Service → 저장소 연결.
- Language: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Instance: Free (시험용)

## 동작

- WASD / 방향키 이동
- 녹색 발판에 3명이 있으면 매칭
- 퍼즐 1: 세 명이 각기 다른 스위치를 3초 안에 E로 작동
- 퍼즐 2: 플레이어별 다른 숫자 단서 공유해 3자리 비밀번호 입력
- 탈출 및 대기실 복귀

이것은 학습용 프로토타입으로, 세 번째 퍼즐과 정교한 3D 모델, 사용자 인증, 데이터베이스, 모바일 조작, 네트워크 지연 보정은 포함하지 않습니다.
