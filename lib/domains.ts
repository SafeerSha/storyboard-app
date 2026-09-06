export const FREELANCER_DOMAIN = process.env.NEXT_PUBLIC_FREELANCER_DOMAIN || "storyboard.com";
export const CLIENT_DOMAIN = process.env.NEXT_PUBLIC_CLIENT_DOMAIN || "storyboard-client.com";

export function isClientDomain(hostname: string): boolean {
  const host = hostname.split(':')[0];
  if (process.env.NODE_ENV !== "production" && host === "client.localhost") {
    return true;
  }
  return host === CLIENT_DOMAIN;
}

export function isFreelancerDomain(hostname: string): boolean {
  const host = hostname.split(':')[0];
  if (process.env.NODE_ENV !== "production" && host === "localhost") {
    return true;
  }
  return host === FREELANCER_DOMAIN || (!isClientDomain(hostname) && process.env.NODE_ENV !== "production");
}
