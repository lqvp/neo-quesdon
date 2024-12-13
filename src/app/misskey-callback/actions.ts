'use server';

import { cookies } from 'next/headers';
import { DBpayload, misskeyAccessKeyApiResponse } from '..';
import { MiUser } from '@/api/_misskey-entities/user';
import { fetchNameWithEmoji } from '@/api/_utils/fetchUsername';
import { validateStrict } from '@/utils/validator/strictValidator';
import { misskeyCallbackTokenClaimPayload } from '@/app/_dto/misskey-callback/callback-token-claim.dto';
import { misskeyUserInfoPayload } from '@/app/_dto/misskey-callback/user-info.dto';
import { GetPrismaClient } from '@/app/api/_utils/getPrismaClient/get-prisma-client';
import { Logger } from '@/utils/logger/Logger';
import { generateJwt } from '@/api/_utils/jwt/generate-jwt';
import { QueueService } from '@/_service/queue/queueService';
import { RedisService } from '@/app/api/_service/redisService/redis-service';

const logger = new Logger('misskey-callback');
export async function login(loginReqestData: misskeyCallbackTokenClaimPayload): Promise<misskeyUserInfoPayload> {
  let loginReq: misskeyCallbackTokenClaimPayload;
  try {
    loginReq = await validateStrict(misskeyCallbackTokenClaimPayload, loginReqestData);
  } catch (err) {
    throw new Error(JSON.stringify(err));
  }
  loginReq.misskeyHost = loginReq.misskeyHost.toLowerCase();

  const redis = RedisService.getRedis();
  const session = await redis.get(`login/misskey/${loginReq.callback_token}`);
  if (!session) {
    throw new Error('ログインセッションが見つかりません');
  } else {
    await redis.del(`login/misskey/${loginReq.callback_token}`);
  }


  // 미스키 App 인증 API에서 액세스토큰과 MiUser 정보를 받아오기
  const misskeyApiResponse: misskeyAccessKeyApiResponse = await requestMiAccessTokenAndUserInfo(loginReq);
  if (misskeyApiResponse === null) {
    throw new Error(`misskey token get fail!`);
  }

  const user: MiUser = misskeyApiResponse.user;
  const miAccessToken = misskeyApiResponse.accessToken;
  if (typeof user !== 'object' || typeof miAccessToken !== 'string') {
    throw new Error(`fail to get Misskey User/Token`);
  }

  const user_handle = `@${user.username}@${loginReq.misskeyHost}`;

  let nameWithEmoji = await fetchNameWithEmoji({
    name: user.name ?? user.username,
    baseUrl: loginReq.misskeyHost,
    emojis: null,
  });

  if (nameWithEmoji.length === 0) {
    nameWithEmoji = [`${user.username}`];
  }

  // DB 에 로그인 유저 정보 저장
  const dbPayload: DBpayload = {
    account: user.username,
    accountLower: user.username.toLowerCase(),
    hostName: loginReq.misskeyHost,
    handle: user_handle,
    name: nameWithEmoji,
    avatarUrl: user.avatarUrl ?? '',
    accessToken: miAccessToken,
    userId: user.id,
  };
  try {
    await pushDB(dbPayload);
  } catch (err) {
    logger.error(`Fail to push user to DB`, err);
    throw err;
  }

  try {
    // 프론트 쿠키스토어에 쿠키 저장
    const cookieStore = await cookies();
    const prisma = GetPrismaClient.getClient();
    const user = await prisma.user.findUniqueOrThrow({ where: { handle: user_handle } });
    const jwtToken = await generateJwt(loginReq.misskeyHost, user_handle, user.jwtIndex);
    cookieStore.set('jwtToken', jwtToken, {
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
    });
    cookieStore.set('server', loginReq.misskeyHost, {
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
    });
  } catch (err) {
    logger.error(`Make JWT or Set cookie failed!`, err);
    throw err;
  }

  //유저 정보 프론트로 반환
  return { user: user };
}

/**
 * 미스키에서 유저가 권한을 승인한 후, 콜백으로 받은 (App인증 방식) 토큰을 사용해서
 * 미스키에서 accessToken과 유저 정보를 받아옴.
 *  참고: https://misskey-hub.net/ko/docs/for-developers/api/token/app/
 * 인증 성공시 미스키의 /api/auth/session/userkey 응답 바디를 반환, 실패시 null 반환.
 * @param payload callbackTokenClaimPayload
 * @returns misskey appAuth API response body, or null when failed
 */
async function requestMiAccessTokenAndUserInfo(payload: misskeyCallbackTokenClaimPayload) {
  const prisma = GetPrismaClient.getClient();

  const checkInstances = await prisma.server.findFirst({
    where: {
      instances: payload.misskeyHost,
    },
  });

  if (checkInstances) {
    const res = await fetch(`https://${payload.misskeyHost}/api/auth/session/userkey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appSecret: checkInstances.appSecret,
        token: payload.callback_token,
      }),
    });
    if (res.ok) {
      const resBody = await res.json();
      return resBody;
    } else {
      logger.warn(`Fail to get Misskey Access token. Misskey Response:`, res.status, await res.text());
      return null;
    }
  } else {
    return null;
  }
}

async function pushDB(payload: DBpayload) {
  const prisma = GetPrismaClient.getClient();

  const user = await prisma.user.upsert({
    where: {
      handle: payload.handle,
    },
    update: {
      name: payload.name,
      token: payload.accessToken,
      userId: payload.userId,
      profile: {
        update: {
          account: payload.account,
          avatarUrl: payload.avatarUrl,
          name: payload.name,
        },
      },
    },
    create: {
      account: payload.account,
      accountLower: payload.accountLower,
      hostName: payload.hostName,
      handle: payload.handle,
      name: payload.name,
      token: payload.accessToken,
      userId: payload.userId,
      profile: {
        create: {
          account: payload.account,
          avatarUrl: payload.avatarUrl,
          name: payload.name,
        },
      },
    },
  });

  //refersh follows
  const queue = QueueService.get();
  queue.addRefreshFollowJob(user, 'misskey');
}
