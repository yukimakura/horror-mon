FROM node:18

# 必要なツールやパッケージをインストール (例: yarn, git)
RUN apt-get update && apt-get install -y yarn git


# ユーザーを node ユーザーに変更 (セキュリティのため推奨)
# USER node

RUN npm install -g gatsby-cli
# ワークディレクトリを設定
WORKDIR /home/node/app