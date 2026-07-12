import { AutoScalingClient, DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import { DescribeInstancesCommand, EC2Client } from "@aws-sdk/client-ec2";
import { env } from "../../config/env.js";

type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

type IceConfig = {
  iceServers: IceServer[];
  iceTransportPolicy: "all" | "relay";
  bundlePolicy: "max-bundle";
  rtcpMuxPolicy: "require";
  iceCandidatePoolSize: number;
};

const DEFAULT_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:global.stun.twilio.com:3478",
];

export class IceServerService {
  private readonly asg = new AutoScalingClient({ region: env.AWS_REGION });
  private readonly ec2 = new EC2Client({ region: env.AWS_REGION });
  private cachedTurnUrls: string[] = [];
  private turnUrlsExpireAt = 0;

  async getConfig(): Promise<IceConfig> {
    const stunUrls = splitList(process.env.STUN_URLS).length
      ? splitList(process.env.STUN_URLS)
      : DEFAULT_STUN_URLS;
    const turnUrls = await this.getTurnUrls();
    const hasTurn = turnUrls.length > 0 && Boolean(process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL);
    const forceTurn = process.env.FORCE_TURN === "true";

    const iceServers: IceServer[] = [];
    if (!forceTurn || !hasTurn) {
      iceServers.push({ urls: stunUrls });
    }
    if (hasTurn) {
      const username = process.env.TURN_USERNAME as string;
      const credential = process.env.TURN_CREDENTIAL as string;
      iceServers.push({
        urls: turnUrls,
        username,
        credential,
      });
    }

    return {
      iceServers,
      iceTransportPolicy: forceTurn && hasTurn ? "relay" : "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceCandidatePoolSize: 2,
    };
  }

  private async getTurnUrls(): Promise<string[]> {
    if (Date.now() < this.turnUrlsExpireAt) return this.cachedTurnUrls;

    const dynamicHosts = await this.getAsgPublicIps().catch(() => []);
    const fallbackHosts = splitList(process.env.TURN_HOSTS);
    const explicitUrls = splitList(process.env.TURN_URLS);
    const hosts = dynamicHosts.length ? dynamicHosts : fallbackHosts;
    const urls = hosts.flatMap((host) => [
      `turn:${host}:3478?transport=udp`,
      `turn:${host}:3478?transport=tcp`,
    ]);
    this.cachedTurnUrls = unique([...urls, ...explicitUrls]).filter(isValidTurnUrl);
    this.turnUrlsExpireAt = Date.now() + 10000;
    return this.cachedTurnUrls;
  }

  private async getAsgPublicIps(): Promise<string[]> {
    const groupName = process.env.VOICE_ASG_NAME || "app-asg";
    const groups = await this.asg.send(new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [groupName],
    }));
    const ids = groups.AutoScalingGroups?.[0]?.Instances
      ?.filter((instance) => instance.LifecycleState === "InService" && instance.HealthStatus === "Healthy")
      .map((instance) => instance.InstanceId)
      .filter((id): id is string => Boolean(id)) ?? [];

    if (!ids.length) return [];

    const result = await this.ec2.send(new DescribeInstancesCommand({ InstanceIds: ids }));
    return unique(
      result.Reservations
        ?.flatMap((reservation) => reservation.Instances ?? [])
        .filter((instance) => instance.State?.Name === "running")
        .map((instance) => instance.PublicIpAddress)
        .filter((ip): ip is string => Boolean(ip)) ?? [],
    );
  }
}

function splitList(value: string | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isValidTurnUrl(url: string): boolean {
  return /^turns?:[a-zA-Z0-9.-]+:\d+(?:\?transport=(udp|tcp))?$/i.test(url);
}
