# K3s 배포 (toy01.emul.site)

gs-safety와 같은 단일 K3s 서버(Traefik, Cloudflare Full (strict))에 정적 빌드를 nginx로 띄웁니다.

## 처음 한 번

1. Cloudflare DNS에 `toy01` A 레코드를 서버 공인 IP로 추가하고 Proxied(주황 구름)로 둡니다.
2. Cloudflare **SSL/TLS → Origin Server**에서 `toy01.emul.site`(또는 `*.emul.site`) 인증서를 발급해 저장소 밖에 저장합니다.
3. 서버에서 네임스페이스와 TLS Secret을 만듭니다. 개인 키는 Git에 넣지 않습니다.

```bash
sudo k3s kubectl create namespace toy01
sudo k3s kubectl -n toy01 create secret tls toy01-tls --cert=/path/origin.pem --key=/path/origin-key.pem
```

## 배포 / 재배포

```bash
git pull --ff-only
sudo bash deploy/k3s/deploy.sh
```

## 확인

```bash
curl -sk --resolve toy01.emul.site:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://toy01.emul.site
sudo k3s kubectl -n toy01 get pods,svc,ingress
```
