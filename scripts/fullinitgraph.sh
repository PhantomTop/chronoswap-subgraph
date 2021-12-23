#!/bin/sh
su postgres -c 'dropdb graphnodedb'
su postgres -c 'createdb graphnodedb'
systemctl start graph-node.service
#graph-node --postgres-url postgresql://postgres:daniel@localhost:5432/graphnodedb --ethereum-rpc mainnet:http://127.0.0.1:8545 --ipfs 127.0.0.1:5001 --http-port 80 --debug