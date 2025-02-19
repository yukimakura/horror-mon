import React, { useEffect, useRef, useCallback, useState } from "react";
import * as BABYLON from "babylonjs"; // Babylon.js の機能をインポート
import "babylonjs-loaders"; // Babylon.js ローダー (CSVなどのファイル形式を扱うために必要) をインポート
import { workerData } from "worker_threads";
import { isNumberObject } from "util/types";

export class KeypointPair {
  keypoint1: string;
  keypoint2: string;
  constructor(keypoint1: string, keypoint2: string) {
    this.keypoint1 = keypoint1;
    this.keypoint2 = keypoint2;
  }
}

// Viewer コンポーネントの Props の型定義
interface ViewerProps {
  frameData: any[]; // CSV から解析されたフレームデータ (各フレームの関節位置情報)
  frameCount: number; // 総フレーム数
  currentFrame: number; // 現在表示しているフレームのインデックス
  csvHeader: string[]; // CSV ファイルのヘッダー情報
  size: { width: string | number; height: string | number }; // 3D ビューのサイズ (親コンポーネントから指定)
  xMagification: number; // X軸方向の拡大率
  yMagification: number; // Y軸方向の拡大率
  zMagification: number; // Z軸方向の拡大率
  keyFrameSize: number; // キーフレームのサイズ
  keypointPairList: KeypointPair[]; // ボーンペアリスト
}

// 配列の平均を計算する関数
var average = function (arr: number[]): number {
  return arr.reduce((prev, current) => prev + current, 0) / arr.length;
};

// Viewer コンポーネントの実装 (関数コンポーネント)
const Viewer: React.FC<ViewerProps> = ({
  frameData,
  frameCount,
  currentFrame,
  csvHeader,
  size,
  xMagification,
  yMagification,
  zMagification,
  keyFrameSize,
  keypointPairList,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); // canvas 要素への参照を保持 (useRef フックを使用)
  const keypointsRef = useRef<{ [key: string]: BABYLON.Bone }>({}); // ボーンオブジェクトを格納する連想配列への参照を保持
  const skeletonRef = useRef<BABYLON.Skeleton | null>(null); // スケルトンオブジェクトへの参照を保持
  const sceneRef = useRef<BABYLON.Scene | null>(null); // Babylon.js の Scene オブジェクトへの参照を保持
  const [biasPosition, setBiasPosition] = useState<BABYLON.Vector3 | null>(
    null
  ); // ボーンの初期位置 (原点)
  let worldbias: BABYLON.Vector3 | null = null;
  const linesRef = useRef<{ [key: string]: BABYLON.LinesMesh }>({}); // 線メッシュを格納する連想配列への参照を保持

  // useEffect フック: コンポーネントのマウント時と、props (csvHeader, currentFrame, updateKeypoints) が変更された時に実行
  useEffect(() => {
    const canvas = canvasRef.current; // canvasRef から canvas 要素を取得
    if (!canvas) return; // canvas 要素が存在しない場合は処理を中断

    const engine = new BABYLON.Engine(canvas, true); // Babylon.js の Engine を作成 (レンダリングエンジン)
    const scene = new BABYLON.Scene(engine); // Babylon.js の Scene を作成 (3D シーン)
    sceneRef.current = scene; // 作成した scene を sceneRef に保存

    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      10,
      BABYLON.Vector3.Zero(),
      scene
    ); // ArcRotateCamera を作成 (視点操作がしやすいカメラ)
    // var camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 0, -10), scene);

    // コントロールできるようにします。これを書かないとマウスなどの入力を受け付けません。
    camera.attachControl(canvas, true); // カメラ操作を canvas にアタッチ (マウスやタッチ操作で視点変更可能にする)
    let cnt = 0;
    // 複数のライトを作成してシーンを照らす
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          const light = new BABYLON.HemisphericLight(
            `light${cnt}`,
            new BABYLON.Vector3(i, j, k),
            scene
          ); // 半球ライトを作成 (シーン全体を柔らかく照らす)
          cnt++;
        }
      }
    }

    console.log("call init keypoint");
    initKeypoints(scene, csvHeader); // ボーンを初期化 (シーンと CSV ヘッダー情報を渡す)
    memoizedUpdateKeypoints(scene, currentFrame, csvHeader); // 初期フレームを描画 (シーン、初期フレームインデックス、CSV ヘッダー情報を渡す)

    engine.runRenderLoop(() => {
      scene.render(); // レンダリングループを開始 (毎フレーム scene を描画)
    });

    // ウィンドウリサイズ時の処理
    const handleResize = () => {
      engine.resize(); // エンジンにリサイズを通知 (canvas サイズをウィンドウに合わせる)
    };
    window.addEventListener("resize", handleResize); // ウィンドウリサイズイベントを監視

    // スケルトンの中心をワールドの中心にするためのバイアスを初期化
    // setBiasPosition(null);

    // コンポーネントのアンマウント時の処理 (クリーンアップ関数)
    return () => {
      window.removeEventListener("resize", handleResize); // リサイズイベントリスナーを解除
      engine.dispose(); // Babylon.js エンジンを破棄
      scene.dispose(); // Babylon.js シーンを破棄
    };
  }, [csvHeader]); // useEffect の依存配列 (これらの値が変更されたら useEffect が再実行される)

  // useEffect フック: currentFrame prop が変更された時に実行 (フレーム更新処理)
  useEffect(() => {
    if (sceneRef.current) {
      // sceneRef.current が存在する場合のみ実行
      updateKeypointsInternal(sceneRef.current, currentFrame, csvHeader); // ボーンを更新 (シーン、現在のフレームインデックス、CSV ヘッダー情報を渡す)
    }
  }, [currentFrame, csvHeader]); // useEffect の依存配列 (currentFrame, updateKeypoints, csvHeader が変更されたら再実行)

  // useCallback フック: ボーン初期化処理をメモ化 (initKeypoints 関数)
  const initKeypoints = useCallback(
    (scene: BABYLON.Scene, header: string[]) => {
      const skeleton = new BABYLON.Skeleton("skeleton", "skeleton", scene); // スケルトン (骨格) を作成
      skeletonRef.current = skeleton; // 作成したスケルトンを skeletonRef に保存
      const keypoints: { [key: string]: BABYLON.Bone } = {}; // ボーンオブジェクトを格納する連想配列を初期化
      // CSV ヘッダーからボーン名を生成 (例: "NOSE_X" -> "NOSE")
      const keypointNames = header
        .filter((column) => column.endsWith("_X"))
        .map((column) => column.replace("_X", ""));

      console.info("keypointNames", keypointNames);

      const initialPosition = BABYLON.Vector3.Zero(); // ボーンの初期位置 (原点)
      const lines: { [key: string]: BABYLON.LinesMesh } = {}; // 線メッシュを格納する連想配列を初期化

      // ボーンとメッシュの作成
      for (let i = 0; i < keypointNames.length; i++) {
        const keypointName = keypointNames[i]; // ボーン名を取得
        const keypoint = new BABYLON.Bone(keypointName, skeleton, null); // ボーンを作成 (親ボーンは null = ルートボーン)
        keypoints[keypointName] = keypoint; // 作成したボーンを keypoints 連想配列に格納

        const sphere = BABYLON.MeshBuilder.CreateSphere(
          keypointName + "_mesh",
          { diameter: keyFrameSize },
          scene
        ); // 球体メッシュを作成 (関節の視覚化用)
        sphere.skeleton = skeleton; // メッシュにスケルトンを関連付け

        const keypointTransformNode = new BABYLON.TransformNode(
          keypointName + "_transformNode",
          scene
        ); // TransformNode を作成 (ボーンの位置・回転・スケールを制御するための中間ノード)
        keypointTransformNode.position = initialPosition.clone(); // TransformNode の初期位置を設定
        sphere.parent = keypointTransformNode; // メッシュを TransformNode の子にする
        const axes = new BABYLON.Debug.AxesViewer(scene, 3); // デバッグ用の座標軸を作成
        keypoint.linkTransformNode(keypointTransformNode); // ボーンと TransformNode をリンク (ボーンの動きが TransformNode に反映される)
      }
      
      console.log("接続一覧", keypointPairList);
      for (let keypointPair of keypointPairList) {
        let keypointpairname = `${keypointPair.keypoint1}_to_${keypointPair.keypoint2}`;
        // 線メッシュの作成 (隣接するボーン間に線を作成)
        const line = BABYLON.MeshBuilder.CreateLines(
          keypointpairname, // 線メッシュの名前を作成
          {
            points: [initialPosition, initialPosition], // 初期位置を同じにしておく
            updatable: true, // 動的に更新可能にする
          },
          scene
        ); // 線メッシュを作成
        lines[keypointpairname] = line; // 作成した線メッシュを lines 連想配列に格納

        console.info("keypointpairname", keypointpairname);
      }
      keypointsRef.current = keypoints; // 作成したボーンの連想配列を keypointsRef に保存
      scene.addSkeleton(skeleton); // シーンにスケルトンを追加
      skeletonRef.current = skeleton; // 作成したスケルトンを skeletonRef に保存
      linesRef.current = lines; // 作成した線メッシュの連想配列を linesRef に保存
    },
    [keyFrameSize,keypointPairList]
  ); // useCallback の依存配列 (空 = 初回レンダリング時のみ実行)

  // useCallback フック: ボーン更新処理をメモ化 (updateKeypointsInternal 関数)
  const updateKeypointsInternal = useCallback(
    (scene: BABYLON.Scene, frameIndex: number, header: string[]) => {
      if (!frameData || frameData.length <= frameIndex || !keypointsRef.current) {
        // データが存在しない、またはフレームインデックスが範囲外、または keypointsRef.current がない場合は処理を中断
        console.log("No data or keypoints found");
        return;
      }
      const currentKeypointData = keypointsRef.current; // keypointsRef.current から現在のボーンオブジェクトの連想配列を取得
      const frame = frameData[frameIndex]; // frameData から指定されたフレームのデータを取得

      // スケルトンの中心をワールドの中心にするためのバイアスを設定
      worldbias = new BABYLON.Vector3(
        average(
          Object.keys(currentKeypointData).map((keypointName) => frame[keypointName + "_X"])
        ),
        average(
          Object.keys(currentKeypointData).map((keypointName) => frame[keypointName + "_Y"])
        ),
        average(
          Object.keys(currentKeypointData).map((keypointName) => frame[keypointName + "_Z"])
        )
      );

      // 各ボーンの位置を更新
      for (const keypointName of Object.keys(currentKeypointData)) {
        // keypoints 連想配列のキー (ボーン名) をループ処理
        const xColumnName = `${keypointName}_X`; // X 座標のカラム名を作成 (例: "NOSE_X")
        const yColumnName = `${keypointName}_Y`; // Y 座標のカラム名を作成 (例: "NOSE_Y")
        const zColumnName = `${keypointName}_Z`; // Z 座標のカラム名を作成 (例: "NOSE_Z")

        // ヘッダーから各座標のカラムインデックスを取得
        const xColumnIndex = header.indexOf(xColumnName);
        const yColumnIndex = header.indexOf(yColumnName);
        const zColumnIndex = header.indexOf(zColumnName);

        // 全ての座標 (X, Y, Z) のカラムインデックスが正常に取得できた場合
        if (xColumnIndex !== -1 && yColumnIndex !== -1 && zColumnIndex !== -1) {
          const x = (frame[xColumnName] - (worldbias?.x ?? 0)) * xMagification; // X 座標の値を取得
          const y = (frame[yColumnName] - (worldbias?.y ?? 0)) * yMagification; // Y 座標の値を取得
          const z = (frame[zColumnName] - (worldbias?.z ?? 0)) * zMagification; // Z 座標の値を取得
          const transformNode = currentKeypointData[keypointName].getTransformNode(); // ボーンに対応する TransformNode を取得
          transformNode?.position?.set(x, y, z); // ボーンに関連付けられた TransformNode の位置を XYZ 座標で設定 (ボーンの位置を更新)

          // 線メッシュの位置と長さを更新
          const keypointIndex = Object.keys(currentKeypointData).indexOf(keypointName); // 現在のボーンのインデックスを取得
          if (keypointIndex > 0) {
            // 最初のボーンでない場合 (前のボーンが存在する場合)
            const previousKeypointName =
              Object.keys(currentKeypointData)[keypointIndex - 1]; // 前のボーンの名前を取得
            const previousTransformNode =
              currentKeypointData[previousKeypointName].getTransformNode(); // 前のボーンに対応する TransformNode を取得

            //現在のボーンにつながるボーンを検索
            const keypointPairs = keypointPairList.filter((pair) => pair.keypoint1 === keypointName);  
            for (let keypointPair of keypointPairs) {
              // 線メッシュの名前を作成
              const lineName = `${keypointPair.keypoint1}_to_${keypointPair.keypoint2}`;
              const line = linesRef.current[lineName]; // 線メッシュを取得
              if (line) {
                // 線メッシュが存在する場合
                const points = [
                  transformNode!.position,
                  currentKeypointData[keypointPair.keypoint2].getTransformNode()!.position,
                ]; // 線メッシュの頂点座標を更新
                linesRef.current[lineName] = BABYLON.MeshBuilder.CreateLines(
                  lineName,
                  {
                    points: points,
                    updatable: true,
                    instance: line,
                  }
                );
              }
            }
            
          }
        } else {
          // カラムインデックスが取得できなかった場合は警告ログを出力 (CSV データに問題がある可能性)
          console.warn(
            `フレーム ${frameIndex} のボーン ${keypointName} のデータが見つかりません`
          );
        }
      }
    },
    [frameData, xMagification, yMagification, zMagification]
  ); // useCallback の依存配列 (frameData が変更されたら再生成)

  // 親コンポーネントから渡された updateKeypoints をラップして useCallback でメモ化
  // (props として渡された updateKeypoints は空関数だが、このコンポーネント内部の updateKeypointsInternal を使用するようにするため)
  const memoizedUpdateKeypoints = useCallback(
    (scene: BABYLON.Scene, frameIndex: number, csvHeader: string[]) => {
      console.info("call memoizedUpdateKeypoints");
      updateKeypointsInternal(scene, frameIndex, csvHeader);
    },
    [updateKeypointsInternal, csvHeader] // 依存配列に updateKeypointsInternal と csvHeader を指定
  );

  // JSX: コンポーネントの描画内容
  return (
    <canvas
      id="renderCanvas"
      ref={canvasRef}
      style={{ width: size.width, height: size.height, display: "block" }}
    />
  ); // canvas 要素をレンダリング (style 属性でサイズを親コンポーネントから受け取った size props で指定)
};

export default Viewer; // Viewer コンポーネントを export (他のコンポーネントから利用可能にする)
