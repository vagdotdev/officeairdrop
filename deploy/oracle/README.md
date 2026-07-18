# Oracle Always Free maid

This deploys the blind ciphertext maid on one OCI A1 VM. The browser keeps the
AES key; Oracle stores only authenticated ciphertext chunks.

## OCI resources

Create all resources in the account's home region and confirm they show as
Always Free eligible:

1. A public VCN/subnet with an internet gateway.
2. One Ubuntu ARM64 `VM.Standard.A1.Flex` instance (2 OCPUs, 12 GB RAM).
3. A 50 GB boot volume.
4. A separate 150 GB block volume in the same availability domain.
5. A reserved public IP attached to the VM.

The 50 GB boot volume plus 150 GB data volume consumes the full 200 GB
Always Free block-volume allowance.

Allow inbound TCP 80 and 443 from the Internet. Restrict TCP 22 to your own IP.
No UDP range or TURN server is needed because the Oracle maid uses resumable
HTTPS rather than server-side WebRTC.

## Mount the data volume

SSH to the VM and identify the newly attached, empty volume:

```sh
lsblk -f
```

Set `DEVICE` to that volume only after verifying it is not the boot disk.
Formatting destroys anything already on the selected device.

```sh
DEVICE=/dev/oracleoci/oraclevdb
sudo mkfs.ext4 -m 0 "$DEVICE"
sudo mkdir -p /srv/maid
UUID="$(sudo blkid -s UUID -o value "$DEVICE")"
echo "UUID=$UUID /srv/maid ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a
sudo chown 1000:1000 /srv/maid
df -h /srv/maid
```

Mount by UUID so replacement VMs do not depend on a particular device name.

## Start the service

Install Docker and Git using the current Ubuntu packages, then clone this
repository:

```sh
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"
newgrp docker
git clone https://github.com/vagdotdev/officeairdrop.git
cd officeairdrop/deploy/oracle
cp .env.example .env
```

Point the `MAID_HOST` DNS A record at the reserved public IP. Edit `.env`, set
the browser origin, and generate the private creation key:

```sh
openssl rand -base64 32
```

Store that value as `MAID_ACCESS_TOKEN`; do not commit `.env`. Start the maid:

```sh
docker compose up -d --build
docker compose ps
curl "https://${MAID_HOST}/health"
```

Caddy obtains and renews TLS automatically. The maid container writes only to
`/srv/maid` and restarts after VM reboot.

## Connect the browser app

Build the client with:

```sh
VITE_MAID_URL=https://maid.example.com
```

Open `/park`, select files, and enter `MAID_ACCESS_TOKEN`. The generated
recovery link contains the per-park capability and AES key in its URL fragment.
Save that link outside the computer being reset.

Do not erase the source computer until the page says **Safely parked**. That
state is reached only after every ciphertext chunk has been hashed, written,
fsynced, and acknowledged by the maid.

## Backup and VM replacement

Before erasing the source computer, create an OCI backup of the 150 GB data
volume and wait for it to complete.

If the free VM is reclaimed:

1. Preserve and detach the 150 GB data volume.
2. Delete the old boot volume so the account has 50 GB free.
3. Create a replacement A1 VM in the same availability domain.
4. Reassign the reserved public IP.
5. Attach the existing data volume and run `sudo mount -a`.
6. Start this Compose project again.

The data volume is the durable maid. VMs are replaceable. Never select the
option that permanently deletes the attached data volume.
