import { BabylonFileLoaderConfiguration } from "babylonjs";
import { KeypointPair } from "../components/viewer";
import { useRef } from "react";
import * as BABYLON from "babylonjs"; // Babylon.js の機能をインポート
import "babylonjs-loaders";
import { keypoint_connection } from "../entities/keypoint_connection"

export class SkeletonDrawer {
    public Frames: Array<any> = [];
    public CsvHeader: string[] = [];
    public KeypointNames: string[] = [];
    public InstanceUniqueId: string = "";
    public Color: BABYLON.Color3;
    public IsShow: boolean = true;
    xMagification: number; // X軸方向の拡大率
    yMagification: number; // Y軸方向の拡大率
    zMagification: number; // Z軸方向の拡大率
    keypointPairList: keypoint_connection[] = [];
    myMaterial!: BABYLON.StandardMaterial;
    keyPointRadiusSize: number;

    constructor(
        frames: Array<any>,
        csvHeader: string[],
        xMagification: number,
        yMagification: number,
        zMagification: number,
        keypointPairList: keypoint_connection[],
        color: BABYLON.Color3,
        keyPointRadiusSize: number
    ) {
        this.InstanceUniqueId = new Date().toLocaleTimeString();
        this.Frames = frames;
        this.CsvHeader = csvHeader.map(x => this.genKeynpointName(x));
        this.xMagification = xMagification;
        this.yMagification = yMagification;
        this.zMagification = zMagification;
        this.keypointPairList = keypointPairList.map(x => {
            let newdata = new keypoint_connection();
            newdata.from_keypoint = this.genKeynpointName(x.from_keypoint);
            newdata.to_keypoint = this.genKeynpointName(x.to_keypoint);
            return newdata;
        });

        this.keyPointRadiusSize = keyPointRadiusSize
        this.Color = color;
    }

    private genKeynpointName(keypointName: string): string {
        return this.InstanceUniqueId + "_" + keypointName;
    }

    private getRawKeynpointName(keypointName: string): string {
        return keypointName.replaceAll(this.InstanceUniqueId + "_", "");
    }


    // 配列の平均を計算する関数
    private average(arr: number[]): number {
        return arr.reduce((prev, current) => prev + current, 0) / arr.length;
    };


    public InitKeypoints(
        scene: BABYLON.Scene,
        skeleton: BABYLON.Skeleton,
        keypointsRef: React.MutableRefObject<{
            [key: string]: BABYLON.Bone;
        }>,// ボーンオブジェクトを格納する連想配列への参照を保持
        linesRef: React.MutableRefObject<{
            [key: string]: BABYLON.LinesMesh;
        }>// 線メッシュを格納する連想配列への参照を保持
    ) {

        this.myMaterial = new BABYLON.StandardMaterial(`${this.InstanceUniqueId}_Material`, scene)
        this.myMaterial.diffuseColor = this.Color;
        this.myMaterial.wireframe = false;

        // CSV ヘッダーからボーン名を生成 (例: "NOSE_X" -> "NOSE")
        this.KeypointNames = this.CsvHeader
            .filter((column) => column.endsWith("_X"))
            .map((column) => column.replace("_X", ""));

        console.info("keypointNames", this.KeypointNames);

        const initialPosition = BABYLON.Vector3.Zero(); // ボーンの初期位置 (原点)
        // const lines: { [key: string]: BABYLON.LinesMesh } = {}; // 線メッシュを格納する連想配列を初期化

        // ボーンとメッシュの作成
        for (let i = 0; i < this.KeypointNames.length; i++) {
            const keypointName = this.KeypointNames[i]; // ボーン名を取得
            const keypoint = new BABYLON.Bone(keypointName, skeleton, null); // ボーンを作成 (親ボーンは null = ルートボーン)
            keypointsRef.current[keypointName] = keypoint; // 作成したボーンを keypoints 連想配列に格納

            const sphere = BABYLON.MeshBuilder.CreateSphere(
                keypointName + "_mesh",
                {
                    diameter: this.keyPointRadiusSize,
                    updatable: true
                },
                scene
            ); // 球体メッシュを作成 (関節の視覚化用)
            sphere.material = this.myMaterial
            sphere.skeleton = skeleton; // メッシュにスケルトンを関連付け

            const keypointTransformNode = new BABYLON.TransformNode(
                keypointName + "_transformNode",
                scene
            ); // TransformNode を作成 (ボーンの位置・回転・スケールを制御するための中間ノード)
            keypointTransformNode.position = initialPosition.clone(); // TransformNode の初期位置を設定
            sphere.parent = keypointTransformNode; // メッシュを TransformNode の子にする
            keypoint.linkTransformNode(keypointTransformNode); // ボーンと TransformNode をリンク (ボーンの動きが TransformNode に反映される)
        }

        console.log("接続一覧", this.keypointPairList);
        for (let keypointPair of this.keypointPairList) {
            let keypointpairname = `${keypointPair.from_keypoint}_to_${keypointPair.to_keypoint}`;
            // 線メッシュの作成 (隣接するボーン間に線を作成)
            const line = BABYLON.MeshBuilder.CreateLines(
                keypointpairname, // 線メッシュの名前を作成
                {
                    points: [initialPosition, initialPosition], // 初期位置を同じにしておく
                    updatable: true, // 動的に更新可能にする
                    material: this.myMaterial
                },
                scene
            ); // 線メッシュを作成
            linesRef.current[keypointpairname] = line; // 作成した線メッシュを lines 連想配列に格納

            console.info("keypointpairname", keypointpairname);
        }
        // keypointsRef.current = keypoints; // 作成したボーンの連想配列を keypointsRef に保存
        // scene.addSkeleton(skeleton); // シーンにスケルトンを追加
        // this.skeletonRef.current = skeleton; // 作成したスケルトンを skeletonRef に保存
        // this.linesRef.current = lines; // 作成した線メッシュの連想配列を linesRef に保存
    }

    public UpdateKeypoints(
        frameIndex: number,
        keypointsRef: React.MutableRefObject<{
            [key: string]: BABYLON.Bone;
        }>,// ボーンオブジェクトを格納する連想配列への参照を保持
        linesRef: React.MutableRefObject<{
            [key: string]: BABYLON.LinesMesh;
        }>// 線メッシュを格納する連想配列への参照を保持
    ) {

        if (
            !this.Frames ||
            this.Frames.length <= frameIndex ||
            !keypointsRef.current
        ) {
            // データが存在しない、またはフレームインデックスが範囲外、または keypointsRef.current がない場合は処理を中断
            console.log("No data or keypoints found");
            return;
        }
        const currentKeypointData = keypointsRef.current; // keypointsRef.current から現在のボーンオブジェクトの連想配列を取得
        const frame = this.Frames[frameIndex]; // frameData から指定されたフレームのデータを取得

        // スケルトンの中心をワールドの中心にするためのバイアスを設定
        let worldbias = new BABYLON.Vector3(
            this.average(
                Object.keys(currentKeypointData).filter(x => x.startsWith(this.InstanceUniqueId)).map(
                    (keypointName) => frame[this.getRawKeynpointName(keypointName) + "_X"]
                )
            ),
            this.average(
                Object.keys(currentKeypointData).filter(x => x.startsWith(this.InstanceUniqueId)).map(
                    (keypointName) => frame[this.getRawKeynpointName(keypointName) + "_Y"]
                )
            ),
            this.average(
                Object.keys(currentKeypointData).filter(x => x.startsWith(this.InstanceUniqueId)).map(
                    (keypointName) => frame[this.getRawKeynpointName(keypointName) + "_Z"]
                )
            )
        );

        // 各ボーンの位置を更新
        for (const keypointName of Object.keys(currentKeypointData).filter(x => x.startsWith(this.InstanceUniqueId))) {
            // keypoints 連想配列のキー (ボーン名) をループ処理
            const xColumnName = `${keypointName}_X`; // X 座標のカラム名を作成 (例: "NOSE_X")
            const yColumnName = `${keypointName}_Y`; // Y 座標のカラム名を作成 (例: "NOSE_Y")
            const zColumnName = `${keypointName}_Z`; // Z 座標のカラム名を作成 (例: "NOSE_Z")

            // ヘッダーから各座標のカラムインデックスを取得
            const xColumnIndex = this.CsvHeader.indexOf(xColumnName);
            const yColumnIndex = this.CsvHeader.indexOf(yColumnName);
            const zColumnIndex = this.CsvHeader.indexOf(zColumnName);

            // 全ての座標 (X, Y, Z) のカラムインデックスが正常に取得できた場合
            if (xColumnIndex !== -1 && yColumnIndex !== -1 && zColumnIndex !== -1) {
                const x = (frame[this.getRawKeynpointName(xColumnName)] - (worldbias?.x ?? 0)) * this.xMagification; // X 座標の値を取得
                const y = (frame[this.getRawKeynpointName(yColumnName)] - (worldbias?.y ?? 0)) * this.yMagification; // Y 座標の値を取得
                const z = (frame[this.getRawKeynpointName(zColumnName)] - (worldbias?.z ?? 0)) * this.zMagification; // Z 座標の値を取得
                const transformNode = currentKeypointData[keypointName].getTransformNode(); // ボーンに対応する TransformNode を取得
                transformNode?.position?.set(x, y, z); // ボーンに関連付けられた TransformNode の位置を XYZ 座標で設定 (ボーンの位置を更新)
                transformNode?.setEnabled(this.IsShow)
                // 線メッシュの位置と長さを更新
                const keypointIndex =
                    Object.keys(currentKeypointData).indexOf(keypointName); // 現在のボーンのインデックスを取得

            } else {
                // カラムインデックスが取得できなかった場合は警告ログを出力 (CSV データに問題がある可能性)
                console.warn(
                    `フレーム ${frameIndex} のボーン ${keypointName} のデータが見つかりません`
                );
            }


            // 各関節をつなぐ線の更新
            for (const keypointName of Object.keys(currentKeypointData).filter(x => x.startsWith(this.InstanceUniqueId))) {

                //現在のボーンにつながるボーンを検索
                const keypointPairs = this.keypointPairList.filter(
                    (pair) => pair.from_keypoint == keypointName
                );
                const transformNode = currentKeypointData[keypointName].getTransformNode(); // ボーンに対応する TransformNode を取得
                for (const keypointName of Object.keys(currentKeypointData).filter(x => x.startsWith(this.InstanceUniqueId))) {
                    for (let keypointPair of keypointPairs) {
                        // 線メッシュの名前を作成
                        const lineName = `${keypointPair.from_keypoint}_to_${keypointPair.to_keypoint}`;
                        const line = linesRef.current[lineName]; // 線メッシュを取得
                        if (line) {
                            // 線メッシュが存在する場合
                            const points = [
                                transformNode!.position,
                                currentKeypointData[
                                    keypointPair.to_keypoint
                                ].getTransformNode()!.position,
                            ]; // 線メッシュの頂点座標を更新

                            linesRef.current[lineName] = BABYLON.MeshBuilder.CreateLines(
                                lineName,
                                {
                                    points: points,
                                    updatable: true,
                                    instance: line,
                                    material: this.myMaterial
                                },
                            );
                            linesRef.current[lineName].isVisible = this.IsShow;

                        }
                    }
                }
            }
        }

    }
}