/*
 * @Description:
 * @version: 1.0.0
 * @Author: william
 * @Date: 2021-10-12 18:04:00
 * @LastEditors: william
 * @LastEditTime: 2021-10-12 18:04:35
 * @For What?:
 */
export default class ClipPlayer {
    constructor(options) {
        debugger
        window.clipPlayer = this
        this.version = '2.1.1.release'

        let defaults = {
            canvasId: 'canvas',
            license: '',
            isVideoSourcePrepared: null,
            playCallback: null,
            onPlay: null,
            onFail: null,
            onFinished: null,
            playWaitTime: 10000, // 播放最长等待时间，当失败或者资源卡住超过当前时间，停止播放，并回调 onFail
        }

        this.options = Object.assign({}, defaults, options)

        this.canvasId = this.options.canvasId

        // 是否只播放正文
        this.onlyPlayContent = false

        // 是否播放人名条/校徽/课标
        this.playOverlayWares = true

        // 是否播放已裁减的片段
        this.playDeleteSegment = true
        this.originWidth = 1920
        this.originHeight = 1080
        this.originTeacherWidth = 640
        this.width = 640
        this.height = 360

        this.fps = 20
        this.interval = 1000 / this.fps
        this.gScale = this.width / this.originWidth
        this.vScale = this.originTeacherWidth / this.originWidth
        this.teacherScale = this.gScale / this.vScale
        this.initEditor(this.canvasId)
        this.init()

        window.clipWorker = new ClipWorker()
        window.clipWorker.onmessage = (messageEvent) => {
            let {
                data: { id, type, res, fullPath, status },
            } = messageEvent
            let currentSource = window.clipPlayer.sources[id]
            // 资源已经被删除
            if (currentSource == undefined) {
                return
            }
            if (type === 1) {
                currentSource.loadFile(res, fullPath, status)
            } else {
                currentSource.loadNetworkResourceZip(res, status)
            }
        }
    }

    init() {
        if (this.inited) {
            return
        }

        this.inited = true
        this.totalDuration = 0
        this.playWaitCount = this.options.playWaitTime
        this.enableUnprepare = false
        this.isDrawing = false
        this.shouldPause = false

        this.transitionTime = 0

        this.playTransition = true
        this.playImageSkin = true
        this.usePreviewImage = true

        this.bgGroup = null // 背景
        this.segmentGroups = []
        this.overlayGroups = [] // 人名贴,等覆盖式
        this.tracks = []

        this.isPlaying = false
        this.offsetTime = 0
        this.currentTime = 0
        this.playEndTime = -1 // 播放结束时间
        this.playInterval = null
        this.playAudioInterval = null
        this.onPlayCalled = false

        this.needPlayAudio = true
        this.needSeek = false
        this.needPlayingSeek = false
        this.isDraw = false

        this.sourceCacheSize = 200 * 1024 * 1024
        this.sources = {}
        this.sourcePrepareOffset = 10000
        this.prepareOffset = 10000
        this.unprepareOffset = 10000

        this.sourcesToUnprepare = []
        this.globalSources = []
    }

    initEditor(canvasId) {
        var options = new Module.SXEditOptions(
            this.options.license,
            this.width,
            this.height
        )
        console.log(options, '======')
        options.setCanvasId(canvasId)
        options.setEnableSourceManager(true)
        options.setFps(this.fps)
        this.editor = new Module.SXEditManager(options, true, -1)
        this.mainGroup = this.editor.mainGroup()
        this.mainGroup.setAutoSort(false)
        if (this.audioPlayer == null) {
            this.audioPlayer = new SXAudioPlayer()
            let audioBuffer = this.editor.prepareAudioManager(
                this.audioPlayer.sampleSize
            )
            this.audioPlayer.setAudioSourceBuffer(audioBuffer)
            var audioPlayCallback = SXSdk.createPersistCallback(function (
                code,
                data
            ) {
                window.clipPlayer.audioPlayer.playAudioFrame()
            })
            window.clipPlayer.editor.setCallback(1, audioPlayCallback)
        }
    }

    setMaskShape(track, crop) {
        if (crop == null || crop.isActive != 1) {
            return
        }

        let x = crop.disLeft * this.vScale
        let y = crop.disTop * this.vScale
        let w = crop.width * this.vScale
        let h = crop.height * this.vScale

        var shape = new SXShape()
        shape.moveTo(x, y)
        shape.lineTo(x + w, y)
        shape.lineTo(x + w, y + h)
        shape.lineTo(x, y + h)
        shape.lineTo(x, y)
        track.mediaTrack.setMaskShape(shape)
        track.maskShape = shape
    }

    scaledVec2(x, y) {
        return new SXVec2(x * this.gScale, y * this.gScale)
    }

    pushToSources(sources, source) {
        if (source == null) {
            // console.error("invalid source");
            return
        }

        sources.push(source)
    }

    // 释放资源
    releaseSources(list) {
        for (let i = 0; i < list.length; i++) {
            list[i].unload()
        }
    }

    // 获取时间段内使用到的素材
    getSourcesBetween(start, end) {
        let sources = []
        // 全局素材
        for (const key in this.globalSources) {
            const element = this.globalSources[key]
            this.pushToSources(sources, element)
        }

        // 段落
        for (const key in this.segmentGroups) {
            const group = this.segmentGroups[key]
            if (!this.isTrackInRange(start, end, group)) {
                continue
            }

            if (this.isTrackInRange(start, end, group)) {
                this.pushToSources(sources, group.exitEffectSource)
            }

            // 背景
            for (let i = 0; i < group.bgTracks.length; i++) {
                let track = group.bgTracks[i]
                if (this.isTrackInRange(start, end, track)) {
                    this.pushToSources(sources, track.mainSource)
                }
            }

            // 教师视频
            let videoTracks = group.baseTracks
            for (let i = 0; i < videoTracks.length; i++) {
                let track = videoTracks[i]
                if (this.isTrackInRange(start, end, track)) {
                    this.pushToSources(sources, track.mainSource)
                    if (track.audioSource != null) {
                        this.pushToSources(sources, track.audioSource)
                    }
                }
            }

            // 脚本课件
            let tracks = group.wareTracks
            for (let i = 0; i < tracks.length; i++) {
                let track = tracks[i]
                if (this.isTrackInRange(start, end, track)) {
                    this.pushToSources(sources, track.mainSource)
                    this.pushToSources(sources, track.intoEffectSource)
                    this.pushToSources(sources, track.exitEffectSource)
                }
            }

            // 课件
            for (let i = 0; i < group.overlayTracks.length; i++) {
                let track = group.overlayTracks[i]
                if (this.isTrackInRange(start, end, track)) {
                    this.pushToSources(sources, track.mainSource)
                    this.pushToSources(sources, track.intoEffectSource)
                    this.pushToSources(sources, track.exitEffectSource)
                }
            }
            console.log(this.globalSources, group, '===global===')
        }

        // 人名贴，课标，课件
        if (this.playOverlayWares) {
            for (let i = 0; i < this.overlayGroups.length; i++) {
                let track = this.overlayGroups[i].overlayTracks[0]
                if (this.isTrackInRange(start, end, track)) {
                    this.pushToSources(sources, track.mainSource)
                    this.pushToSources(sources, track.intoEffectSource)
                    this.pushToSources(sources, track.exitEffectSource)
                }
            }
        }
        console.log(sources)
        return sources
    }

    addOverlayGroups(targetGroups, start, end) {
        let prepared = true
        for (let i = 0; i < targetGroups.length; i++) {
            let track = targetGroups[i].overlayTracks[0]
            if (track.isAdded) {
                continue
            }
            if (!this.isTrackInRange(start, end, track)) {
                continue
            }

            if (track.veGroup == null) {
                track.veGroup = this.editor.addNewGroup()
            }

            if (!this.isTrackPrepared(track)) {
                prepared = false
                continue
            }

            let mediaTrack = track.mediaTrack
            console.log(
                '--- overlay track inpoint ' +
                    track.getInPoint() +
                    ', outpoint ' +
                    track.getOutPoint() +
                    ', ' +
                    track.getDisplayTimeInSeconds()
            )

            track.isAdded = true
            track.mediaTrack = mediaTrack
            track.veGroup.setTrackDuration(
                mediaTrack.trackId(),
                track.getDisplayTimeInSeconds()
            )

            mediaTrack.fitToEditContext(true, 0)

            // 动画
            if (track.intoEffectSource != null) {
                let into = track.mediaTrack.addAnimation(
                    track.intoEffectSource.localPath
                )
                track.veIntoEffect = into
                into.setFollowType(SXEffectTimeFollowType.kFollowStart)
                into.setDuration(track.intoEffectDuration / 1000)
                into.setDurationOfOneCycle(track.intoEffectDuration / 1000)
            }

            if (track.exitEffectSource != null) {
                let effect = track.mediaTrack.addAnimation(
                    track.exitEffectSource.localPath
                )
                track.veExitEffect = effect
                effect.setFollowType(SXEffectTimeFollowType.kFollowEnd)
                effect.setDuration(track.exitEffectDuration / 1000)
                effect.setDurationOfOneCycle(track.exitEffectDuration / 1000)
            }
        }

        return prepared
    }

    tileCroppedVideo(track, crop) {
        let cropPosX =
            window.clipPlayer.originWidth / 2 - (crop.disLeft + crop.width / 2)
        let cropPosY =
            window.clipPlayer.originHeight / 2 - (crop.disTop + crop.height / 2)

        let _scale1 =
            window.clipPlayer.originTeacherWidth / window.clipPlayer.originWidth
        let _pscale = window.clipPlayer.width / crop.width / _scale1 + 0.005
        track.mediaTrack.setPosition(
            new SXVec2(
                cropPosX * _scale1 * _pscale + window.clipPlayer.width / 2,
                cropPosY * _scale1 * _pscale + window.clipPlayer.height / 2
            )
        )
        track.mediaTrack.setScale(new SXVec2(_pscale, _pscale))
    }

    handleMediaTrack(track) {
        // console.warn("handler media track 1 : "  + track.id + ":" +track.target.id + ", path: " + track.mainSource.localPath);
        track.isPreparing = false
        if (track.mediaTrack == null) {
            console.warn(
                '--- handler media track 1-1 : ' +
                    track.id +
                    ':' +
                    track.target.id +
                    ', path: ' +
                    track.mainSource.localPath
            )
            return false
        }
        console.log(track.type)
        var volume

        if (track.target.volume || track.target.volume === 0) {
            console.log('track.target.volume')
            volume = track.target.volume * 0.3
            if (volume > 0) {
                track.setAudioVolume(volume)
                track.mediaTrack.setAudioVolume(track.audioVolume)
            }
        } else if (track.type === ClipTrackType.SCRIPT) {
            console.log('SCRIPT')
            console.log(this.parser.scriptVolume)
            volume = this.parser.scriptVolume * 0.3 * 0.7
            if (volume > 0) {
                track.setAudioVolume(volume)
                track.mediaTrack.setAudioVolume(track.audioVolume)
            }
        } else if (track.type === ClipTrackType.BACKGROUND) {
            console.log('BACKGROUND')

            volume = this.parser.bgVolume * 0.3
            if (volume > 0) {
                track.setAudioVolume(volume)
                track.mediaTrack.setAudioVolume(track.audioVolume)
            }
        } else if (track.type === ClipTrackType.VIDEO_HEAD) {
            console.log('VIDEO_HEAD')

            volume = this.parser.headVolume * 0.3
            if (volume > 0) {
                track.setAudioVolume(volume)
                track.mediaTrack.setAudioVolume(track.audioVolume)
            }
        } else if (track.type === ClipTrackType.VIDEO_TAIL) {
            console.log('VIDEO_TAIL')

            volume = this.parser.tailVolume * 0.3
            if (volume > 0) {
                track.setAudioVolume(volume)
                track.mediaTrack.setAudioVolume(track.audioVolume)
            }
        } else if (track.type === ClipTrackType.HEAD_BG) {
            console.log('HEAD_BG')
            volume = this.parser.bgVolume * 0.3
            if (volume > 0) {
                track.setAudioVolume(volume)
                track.mediaTrack.setAudioVolume(track.audioVolume)
            }
        } else if (track.type === ClipTrackType.HEAD_WARE_TITLE) {
            console.log('HEAD_WARE_TITLE')
        } else if (track.type === ClipTrackType.HEAD_WARE_TEACHER) {
            console.log('HEAD_WARE_TEACHER')
        } else if (track.type === ClipTrackType.SCRIPT_INSERT) {
            console.log('SCRIPT_INSERT')
            for (
                let i = 0;
                i < track.player.parser.scriptSegmentWare.length;
                i++
            ) {
                const element = track.player.parser.scriptSegmentWare[i]
                if (element && element.segment === track.target.segment) {
                    for (
                        let j = 0;
                        j < track.player.parser.scriptSuiteMaterial.length;
                        j++
                    ) {
                        const material =
                            track.player.parser.scriptSuiteMaterial[j]
                        if (material.id === element.materialId) {
                            volume = material.volume * 0.3
                            if (volume > 0) {
                                track.setAudioVolume(volume)
                                track.mediaTrack.setAudioVolume(
                                    track.audioVolume
                                )
                            }
                        }
                    }
                }
            }
        }

        console.log('当前音量增益 ' + volume)

        track.isCreated = true

        let addRet = false
        let inpoint = 0
        let outpoint = 0
        outpoint = inpoint + track.getDisplayTimeInSeconds()

        // 设置禁止循环
        // if (track.disableVideoLoop) {
        track.mediaTrack.setLoopMedia(false)
        // }

        // 设置停留在第一帧
        if (track.freezeAtStart) {
            track.mediaTrack.freeze(0)
            track.mediaTrack.setEnableAudio(false)
        }

        if (
            track.type == ClipTrackType.SCRIPT ||
            track.type == ClipTrackType.SCRIPT_GENERATED
        ) {
            track.mediaTrack.setLoopMedia(false)
            if (track.target.type == 1) {
                let sSuiteMaterial =
                    window.clipPlayer.parser.getScriptSuiteMaterialByScript(
                        track.target
                    )
                // 教师视频
                if (sSuiteMaterial) {
                    // 有课件
                    let video =
                        window.clipPlayer.parser.getResourceByCameraStand(
                            window.clipPlayer.parser.getValidCameraStandNo(
                                sSuiteMaterial.cameraStand
                            )
                        )

                    // 没有微调信息, 自动定位
                    if (sSuiteMaterial.teacherLocationAdjust == null) {
                        // 全屏课件素材，直接平铺
                        let fullScreen =
                            sSuiteMaterial.width >= 1910 &&
                            sSuiteMaterial.height >= 1070

                        if (fullScreen && !track.hasImageMatting) {
                            let crop = this.parser.getCropByVideoId(
                                video.videoId
                            )
                            if (crop && crop.isActive == 1) {
                                // 裁剪居中平铺
                                window.clipPlayer.tileCroppedVideo(track, crop)
                                track.moveToCenter = false
                            } else {
                                // 默认居中
                                track.mediaTrack.fitToEditContext(true, 0)
                            }
                        } else {
                            let regionRect = new FaceRect(
                                sSuiteMaterial.disLeft,
                                sSuiteMaterial.disTop,
                                sSuiteMaterial.width,
                                sSuiteMaterial.height
                            )
                            let fitter = new FaceFitter()
                            // let faceRect = window.clipPlayer.facerectData[video.videoId][track.group.baseTracks[0].target.scriptId];
                            let faceRect =
                                window.clipPlayer.parser.getFaceRectData(
                                    video,
                                    track.group.baseTracks[0].target
                                )
                            let bottomSpac =
                                sSuiteMaterial.width >= sSuiteMaterial.height
                                    ? 2
                                    : 3
                            let topSpac = 0.5
                            //教师定位
                            if (track.hasImageMatting && fullScreen) {
                                topSpac = 1
                                bottomSpac = 3
                            }

                            let ret = fitter.fit(
                                regionRect,
                                faceRect,
                                topSpac,
                                bottomSpac
                            )
                            if (ret) {
                                track.mediaTrack.setPosition(
                                    window.clipPlayer.scaledVec2(
                                        ret.data.x,
                                        ret.data.y
                                    )
                                )
                                track.mediaTrack.setScale(
                                    new SXVec2(
                                        ret.data.scale *
                                            window.clipPlayer.teacherScale,
                                        ret.data.scale *
                                            window.clipPlayer.teacherScale
                                    )
                                )
                            }
                            track.moveToCenter = false
                        }
                    } else {
                        // 直接使用微调信息
                        let adjust = sSuiteMaterial.teacherLocationAdjust
                        track.mediaTrack.setPosition(
                            window.clipPlayer.scaledVec2(adjust.x, adjust.y)
                        )
                        track.mediaTrack.setScale(
                            new SXVec2(
                                adjust.scale * window.clipPlayer.teacherScale,
                                adjust.scale * window.clipPlayer.teacherScale
                            )
                        )
                        track.moveToCenter = false
                    }
                } else {
                    // 没有课件

                    // 如果有裁剪，居中, 使用的是主机位
                    let video =
                        window.clipPlayer.parser.getResourceByCameraStand(1)
                    let crop = this.parser.getCropByVideoId(video.videoId)
                    if (crop) {
                        window.clipPlayer.tileCroppedVideo(track, crop)
                        track.moveToCenter = false
                    } else {
                        // 默认居中
                        track.mediaTrack.fitToEditContext(true, 0)
                    }
                }
            }

            // 机位音频切换, 辅机位只使用视频，音频使用主机位的音频
            if (track.audioSource != null) {
                track.mediaTrack.setEnableAudio(false)
                track.audioTrackId = window.clipPlayer.editor.addAudioTrack(
                    track.audioSource.localPath,
                    track.getInPointInSeconds(),
                    track.getInPointInSeconds(),
                    track.getDisplayTimeInSeconds()
                )

                console.log(
                    '--- video switched, disable audio of current video, add add new audio: ' +
                        track.id +
                        ', ' +
                        track.audioSource.originUrl
                )
            }

            inpoint =
                track.getInPointInSeconds() - track.group.getInPointInSeconds()
            addRet = track.veGroup.addTrack(track.mediaTrack, inpoint)

            if (track.moveToCenter) {
                track.mediaTrack.fitToEditContext(true, 0)
            }

            // 插入课件/ 片头、片尾
        } else if (
            track.type == ClipTrackType.SCRIPT_INSERT ||
            track.type == ClipTrackType.VIDEO_HEAD ||
            track.type == ClipTrackType.VIDEO_TAIL
        ) {
            inpoint =
                track.getInPointInSeconds() - track.group.getInPointInSeconds()
            addRet = track.veGroup.addTrack(track.mediaTrack, inpoint)
            track.mediaTrack.fitToEditContext(true, 0)
        } else if (
            track.type == ClipTrackType.HEAD_BG ||
            track.type == ClipTrackType.BACKGROUND
        ) {
            inpoint =
                track.getInPointInSeconds() - track.group.getInPointInSeconds()
            addRet = track.veGroup.addTrack(track.mediaTrack, inpoint)
            track.mediaTrack.fitToEditContext(true, 0)
            track.mediaTrack.setLoopMedia(true)
        } else if (
            track.type == ClipTrackType.HEAD_WARE_TITLE ||
            track.type == ClipTrackType.HEAD_WARE_TEACHER
        ) {
            inpoint =
                track.getInPointInSeconds() - track.group.getInPointInSeconds()
            addRet = track.veGroup.addTrack(track.mediaTrack, inpoint)
        } else if (track.type == ClipTrackType.COURSE_WARE) {
            // 覆盖课件

            inpoint =
                track.getInPointInSeconds() - track.group.getInPointInSeconds()
            addRet = track.veGroup.addTrack(track.mediaTrack, inpoint)
            track.mediaTrack.fitToEditContext(true, 0)

            // 检查课件视频的时长，如果时长大于段落的时长，需要设置变速
            let duration = track.getDurationInSeconds()
            let displayTime = track.group.getDisplayTimeInSeconds()
            console.log(
                '--- ware track [' +
                    track.getInPoint() +
                    '->' +
                    track.getOutPoint() +
                    '], speed ' +
                    duration / displayTime
            )
            if (duration > displayTime) {
                track.veGroup.setTrackDuration(
                    track.mediaTrack.trackId(),
                    duration
                )
                track.mediaTrack.setSpeed(
                    track.getDurationInSeconds() /
                        track.getDisplayTimeInSeconds()
                )
            } else {
                track.mediaTrack.setLoopMedia(false)
            }
        } else {
            // 人名条、校徽，课标

            inpoint = track.getInPointInSeconds()
            addRet = track.veGroup.addTrack(track.mediaTrack, inpoint)
            track.mediaTrack.fitToEditContext(true, 0)
        }

        console.log(
            '--- add track : ' +
                addRet +
                ', ' +
                track.id +
                ', ' +
                track.type +
                ', [' +
                track.getInPointInSeconds() +
                ' -> ' +
                track.getOutPointInSeconds() +
                '], ' +
                track.mainSource.url
        )
        // window.clipPlayer.editor.addTrack(track.veGroup, track.mediaTrack, track.getInPointInSeconds());
        // track.veGroup.addTrack(track.mediaTrack, track.getInPointInSeconds());
        window.clipPlayer.tracks.push(track)
    }

    async prepareMediaTrack2(track) {
        if (track.isCreated) {
            return false
        }

        if (track.mainSource) {
            track.mediaTrack = window.clipPlayer.editor.createMediaTrack(
                track.mainSource.localPath,
                track.getDisplayTimeInSeconds()
            )
            window.clipPlayer.handleMediaTrack(track)
        } else {
            if (track.audioSource != null && !track.isAdded) {
                track.isCreated = true
                track.isAdded = true
                track.audioTrackId = window.clipPlayer.editor.addAudioTrack(
                    track.audioSource.localPath,
                    track.getInPointInSeconds(),
                    track.getInPointInSeconds(),
                    track.getDisplayTimeInSeconds()
                )

                console.log(
                    '--- add audio track: ' +
                        track.id +
                        ', ' +
                        '[' +
                        track.getInPoint() +
                        ' -> ' +
                        track.getOutPoint() +
                        ']' +
                        track.audioSource.originUrl
                )
                track.isPreparing = false
            }
        }
    }

    prepareMediaTrack(track) {
        let prepareCallback = SXSdk.createCallback(function (code, data) {
            track.isCreated = true
            track.isPreparing = false
            track.mediaTrack = window.clipPlayer.editor.getMediaTrack(data.id)
            window.clipPlayer.handleMediaTrack(track)
        })

        if (track.mainSource) {
            window.clipPlayer.editor.createMediaTrack2(
                track.mainSource.localPath,
                track.getDisplayTimeInSeconds(),
                prepareCallback
            )
        } else {
            if (track.audioSource != null && !track.isAdded) {
                track.isCreated = true
                track.isAdded = true
                track.audioTrackId = window.clipPlayer.editor.addAudioTrack(
                    track.audioSource.localPath,
                    track.getInPointInSeconds(),
                    track.getInPointInSeconds(),
                    track.getDisplayTimeInSeconds()
                )

                console.log(
                    '--- add audio track: ' +
                        track.id +
                        ', ' +
                        '[' +
                        track.getInPoint() +
                        ' -> ' +
                        track.getOutPoint() +
                        ']' +
                        track.audioSource.originUrl
                )
                track.isPreparing = false
            }
        }
    }

    isTrackPrepared(track) {
        if (track.mainSource != null && !track.mainSource.isLoaded) {
            return false
        }

        if (
            track.intoEffectSource != null &&
            !track.intoEffectSource.isLoaded
        ) {
            return false
        }

        if (
            track.exitEffectSource != null &&
            !track.exitEffectSource.isLoaded
        ) {
            return false
        }

        if (track.audioSource != null && !track.audioSource.isLoaded) {
            return false
        }

        if (!track.isCreated && !track.isPreparing) {
            track.isPreparing = true
            this.prepareMediaTrack(track)
            return false
        }

        if (!track.isCreated) {
            return false
        }

        return true
    }

    /**
     * 获取可删除的 track
     *
     */
    getNeedRemoveTracks(start, end) {
        let list = []
        for (const key in this.tracks) {
            const track = this.tracks[key]
            if (!track.isAdded) {
                continue
            }

            if (track.getOutPoint() < start || track.getInPoint() > end) {
                list.push(track)
            }
        }

        // console.log("--- removed tracks " + list.length);
        return list
    }

    /**
     * 删除非当前范围内的 tracks
     *
     */
    unprepare(start, end, removeall) {
        if (removeall) {
            this.sourcesToUnprepare = this.sourcesToUnprepare.concat(
                this.globalSources
            )
        }

        let list = this.getNeedRemoveTracks(start, end)
        if (list.length == 0) {
            return
        }

        for (const key in list) {
            let track = list[key]
            track.isAdded = false
            track.isCreated = false
            if (track.mediaTrack == null) {
                continue
            }

            console.log(
                '--- remove track [' +
                    track.getInPoint() +
                    ',' +
                    track.getOutPoint() +
                    '] : ' +
                    track.mediaTrack.trackId() +
                    ': ' +
                    track.mainSource.url +
                    ' : ' +
                    track.mainSource.localPath
            )

            this.editor.removeTrack(track.mediaTrack.trackId(), true)
            delete track.mediaTrack
            track.mediaTrack = null

            if (track.audioTrackId != null) {
                console.log(
                    '--- remove audio track [' +
                        track.getInPoint() +
                        ',' +
                        track.getOutPoint() +
                        '] : ' +
                        track.audioTrackId +
                        ': ' +
                        track.audioSource.url +
                        ' : ' +
                        track.audioSource.localPath
                )
                this.editor.removeAudioTrack(track.audioTrackId)
                track.audioTrackId = null
            }

            if (track.audioTrackId2 != null) {
                console.log(
                    '--- remove audio track 2 [' +
                        track.getInPoint() +
                        ',' +
                        track.getOutPoint() +
                        '] : ' +
                        track.audioTrackId2
                )
                this.editor.removeAudioTrack(track.audioTrackId2)
                track.audioTrackId2 = null
            }

            // remove source
            if (track.mainSource != null && track.mainSource.isLoaded) {
                this.sourcesToUnprepare.push(track.mainSource)
            }
            if (
                track.intoEffectSource != null &&
                track.intoEffectSource.isLoaded
            ) {
                this.sourcesToUnprepare.push(track.intoEffectSource)
            }
            if (
                track.exitEffectSource != null &&
                track.exitEffectSource.isLoaded
            ) {
                this.sourcesToUnprepare.push(track.exitEffectSource)
            }
            if (track.audioSource != null && track.audioSource.isLoaded) {
                this.sourcesToUnprepare.push(track.audioSource)
            }
        }
    }

    /**
     * 遍历现有轨道, 计算插入到 edit manager
     *
     */
    prepare(start, end) {
        let editor = this.editor
        let width = this.width
        let height = this.height
        let prepared = true

        // 正文
        for (const key in this.segmentGroups) {
            const group = this.segmentGroups[key]
            //  给当前 group 添加转场
            if (
                this.playTransition &&
                group.exitEffectSource != null &&
                this.isTrackInRange(start, end, group)
            ) {
                if (group.exitEffectSource.isLoaded) {
                    if (!group.transitionAdded) {
                        let addRet = this.editor
                            .mainGroup()
                            .addTransition(
                                group.exitEffectSource.localPath,
                                group.veInternalGroup.trackId(),
                                group.exitEffectDuration / 1000
                            )
                        group.transitionAdded = true
                    }
                } else {
                    prepared = false
                }
            }

            // 背景
            for (let i = 0; i < group.bgTracks.length; i++) {
                let track = group.bgTracks[i]
                if (track.isAdded) {
                    continue
                }

                if (!this.isTrackInRange(start, end, track)) {
                    continue
                }
                if (!this.isTrackPrepared(track)) {
                    prepared = false
                    continue
                }

                let mediaTrack = track.mediaTrack
                track.isAdded = true
                console.log(
                    '--- background track, inpoint ' +
                        track.getInPoint() +
                        ', outpoint ' +
                        track.getOutPoint()
                )
            }

            // 片段轨道
            let videoTracks = group.baseTracks
            for (let i = 0; i < videoTracks.length; i++) {
                let track = videoTracks[i]
                if (track.isAdded) {
                    continue
                }
                if (!this.isTrackInRange(start, end, track)) {
                    continue
                }

                if (!this.isTrackPrepared(track)) {
                    prepared = false
                    continue
                }

                let mediaTrack = track.mediaTrack
                track.isAdded = true

                // 插入课件
                if (
                    track.type == ClipTrackType.SCRIPT_INSERT ||
                    track.type == ClipTrackType.SCRIPT_GENERATED
                ) {
                    console.log(
                        '--- segment track, script_insert inpoint ' +
                            track.getInPoint() +
                            ', outpoint ' +
                            track.getOutPoint()
                    )
                } else if (
                    track.type == ClipTrackType.HEAD_WARE_TEACHER ||
                    ClipGroupType.HEAD_WARE_TEACHER
                ) {
                    console.log(
                        '--- chapter track, inpoint ' +
                            track.getInPoint() +
                            ', outpoint ' +
                            track.getOutPoint()
                    )

                    // 教师视频
                } else if (track.type == ClipTrackType.SCRIPT) {
                    console.log(
                        '--- segment track, script inpoint ' +
                            track.getInPoint() +
                            ', outpoint ' +
                            track.getOutPoint()
                    )
                    let sScriptMaterial =
                        this.parser.getScriptSuiteMaterialByScript(track.target)

                    let hasCourseWare = sScriptMaterial ? true : false
                    let cameraStand = hasCourseWare
                        ? sScriptMaterial.cameraStand
                        : 1

                    if (cameraStand > 0) {
                        let video = this.parser.getResourceByCameraStand(
                            this.parser.getValidCameraStandNo(cameraStand)
                        )

                        // 抠图
                        let matting = this.parser.getImageMattingByVideoId(
                            video.videoId
                        )
                        if (matting != null && matting.isActive == 1) {
                            if (matting.type == 1) {
                                let matte = mediaTrack.addGenericEffect(
                                    SXGenericEffectType.kTrackMatte,
                                    track.getDisplayTimeInSeconds()
                                )
                                matte.setAttributeString(
                                    'path',
                                    matting.hueSource.localPath
                                )
                            } else if (matting.type == 0) {
                                let chroma = mediaTrack.addGenericEffect(
                                    SXGenericEffectType.kChromaKey,
                                    track.getDisplayTimeInSeconds()
                                )
                                chroma.setAttributeColor(
                                    'color',
                                    matting.imageMattingBg
                                )
                                chroma.setAttributeFloat(
                                    'similarity',
                                    matting.colorGamut
                                )
                                chroma.setAttributeFloat(
                                    'smoothness',
                                    matting.edgeSmooth
                                )
                                chroma.setAttributeFloat(
                                    'spill_reduce',
                                    matting.intensity
                                )
                                chroma.setAttributeInt(
                                    'edge_thin',
                                    Math.ceil(
                                        (matting.edgeCutting * this.width) /
                                            this.originWidth
                                    )
                                )
                                chroma.setAttributeInt(
                                    'edge_feather',
                                    matting.edgeFeather
                                )
                            }
                        }

                        //色彩调节
                        let color = this.parser.getHueAdjustmentByVideoId(
                            video.videoId
                        )
                        if (color != null) {
                            let colorEffect = mediaTrack.addGenericEffect(
                                SXGenericEffectType.kColorAdjustment,
                                track.getDisplayTimeInSeconds()
                            )
                            colorEffect.setAttributeFloat(
                                'contrast',
                                color.contrast
                            )
                            colorEffect.setAttributeFloat(
                                'sharpen',
                                color.sharpen
                            )
                            colorEffect.setAttributeFloat(
                                'highlight',
                                color.highlight
                            )
                            colorEffect.setAttributeFloat(
                                'shadow',
                                color.shadow
                            )
                            colorEffect.setAttributeFloat(
                                'exposure',
                                color.exposure
                            )
                            colorEffect.setAttributeFloat('cct', color.cct)

                            color.r = color.r ? color.r : 0
                            color.g = color.g ? color.g : 0
                            color.b = color.b ? color.b : 0

                            colorEffect.setAttributeFloat('r', color.r)
                            colorEffect.setAttributeFloat('g', color.g)
                            colorEffect.setAttributeFloat('b', color.b)

                            if (color.rgbMode && color.rgbMode == 2) {
                                colorEffect.setAttributeFloat(
                                    'hue',
                                    color.hue + 0.01
                                )
                                colorEffect.setAttributeFloat(
                                    'saturation',
                                    color.saturation - 0.1
                                )
                                colorEffect.setAttributeFloat(
                                    'brightness',
                                    color.brightnes + 0.03
                                )
                            } else {
                                colorEffect.setAttributeFloat('hue', color.hue)
                                colorEffect.setAttributeFloat(
                                    'saturation',
                                    color.saturation
                                )
                                colorEffect.setAttributeFloat(
                                    'brightness',
                                    color.brightnes
                                )
                            }
                        }

                        // 美颜
                        /**
                         *  "blurAmount": 12,
                            "skinColorRange": 14,
                            "whiten": 87,
                            "redden": 87,
                            "pinking": 87,
                            "skinHue": 0.05
                         * */
                        if (this.playImageSkin) {
                            let skin = this.parser.getImageSkinByVideoId(
                                video.videoId
                            )
                            if (skin != null && skin.isActive) {
                                let skinEffect = mediaTrack.addGenericEffect(
                                    SXGenericEffectType.kFaceBeauty,
                                    track.getDisplayTimeInSeconds()
                                )
                                skinEffect.setAttributeFloat(
                                    'blur',
                                    skin.blurAmount
                                )
                                skinEffect.setAttributeFloat(
                                    'skin_range',
                                    skin.skinColorRange
                                )
                                skinEffect.setAttributeFloat(
                                    'whiten',
                                    skin.whiten
                                )
                                skinEffect.setAttributeFloat(
                                    'redden',
                                    skin.redden
                                )
                                skinEffect.setAttributeFloat(
                                    'pinking',
                                    skin.pinking
                                )
                                skinEffect.setAttributeFloat(
                                    'skin_hue',
                                    skin.skinHue
                                )
                            }
                        }

                        // 裁减
                        let crop = this.parser.getCropByVideoId(video.videoId)
                        this.setMaskShape(track, crop)
                    }
                }
            }

            //  添加课件
            let wareTracks = group.wareTracks
            for (let i = 0; i < wareTracks.length; i++) {
                let track = wareTracks[i]
                if (track.isAdded) {
                    continue
                }

                if (!this.isTrackInRange(start, end, track)) {
                    continue
                }
                if (!this.isTrackPrepared(track)) {
                    prepared = false
                    continue
                }

                let mediaTrack = track.mediaTrack
                track.isAdded = true
                console.log(
                    '--- overlay course ware track, script inpoint ' +
                        track.getInPoint() +
                        ', outpoint ' +
                        track.getOutPoint()
                )
                // 设置色块抠图参数
                // 1. 根据 camera stand 设置抠图颜色
                // 2. 根据 haveGreenBg 设置背景绿色
                let sScriptMaterial = track.target

                let cameraStand = sScriptMaterial.cameraStand
                if (cameraStand != null) {
                    let colorStr = ''
                    if (sScriptMaterial.haveGreenBg > 0) {
                        colorStr = '#00FF00;'
                    }
                    if (cameraStand == 1) {
                        colorStr += '#FF00FF'
                    } else if (cameraStand == 2) {
                        colorStr += '#00FFFF'
                    } else if (cameraStand == 3) {
                        // colorStr += "#FFFF00";
                        console.log('新的颜色修改:')
                        colorStr += '#330066'
                    }

                    if (colorStr != '') {
                        let colorKey = mediaTrack.addGenericEffect(
                            SXGenericEffectType.kMultipleColorKey,
                            track.getDisplayTimeInSeconds()
                        )
                        colorKey.setAttributeString('colors_str', colorStr)
                        colorKey.setAttributeFloat('similarity', 0.15)
                        colorKey.setAttributeFloat('edge_thin', 2)
                    }
                }
            }

            // 添加 base group 中的 overlayer tracks
            // 现阶段只有章节标题用到这个数组, 用于添加，章节标题和教师名
            let overlayTracks = group.overlayTracks
            for (let i = 0; i < overlayTracks.length; i++) {
                let track = overlayTracks[i]
                if (track.isAdded) {
                    continue
                }

                if (!this.isTrackInRange(start, end, track)) {
                    continue
                }
                if (track.veGroup == null) {
                    track.veGroup = track.group.veInternalGroup.addGroupAtIndex(
                        3 + i
                    )
                }
                if (!this.isTrackPrepared(track)) {
                    prepared = false
                    continue
                }

                track.isAdded = true

                let style = null
                if (track.type == ClipTrackType.HEAD_WARE_TITLE) {
                    style = this.parser.getStyleByType(
                        track.target.sceneStyle.styleItems,
                        3
                    )
                } else {
                    style = this.parser.getStyleByType(
                        track.target.sceneStyle.styleItems,
                        4
                    )
                }

                let mediaTrack = track.mediaTrack

                mediaTrack.setScale(
                    this.scaledVec2(
                        style.width / mediaTrack.trackWidth(),
                        style.height / mediaTrack.trackHeight()
                    )
                )
                mediaTrack.setPosition(
                    this.scaledVec2(
                        style.disLeft + style.width / 2,
                        style.disTop + style.height / 2
                    )
                )

                console.log(
                    '--- chapter head ware track  [' +
                        track.getInPoint() +
                        ' -> ' +
                        track.getDisplayTimeInSeconds() +
                        '] :' +
                        mediaTrack.trackId()
                )
                console.log(
                    '--- chapter head ware x : ' +
                        style.disLeft +
                        ', y: ' +
                        style.disTop +
                        ', w: ' +
                        style.width +
                        ', height: ' +
                        style.height +
                        ', ow : ' +
                        mediaTrack.trackWidth() +
                        ', oh: ' +
                        mediaTrack.trackHeight()
                )

                // 动画
                if (track.intoEffectSource != null) {
                    let into = track.mediaTrack.addAnimation(
                        track.intoEffectSource.localPath
                    )
                    track.veIntoEffect = into
                    into.setFollowType(SXEffectTimeFollowType.kFollowStart)
                    into.setDuration(track.intoEffectDuration / 1000)
                    into.setDurationOfOneCycle(track.intoEffectDuration / 1000)
                }

                if (track.exitEffectSource != null) {
                    let effect = track.mediaTrack.addAnimation(
                        track.exitEffectSource.localPath
                    )
                    track.veExitEffect = effect
                    effect.setFollowType(SXEffectTimeFollowType.kFollowEnd)
                    effect.setDuration(track.exitEffectDuration / 1000)
                    effect.setDurationOfOneCycle(
                        track.exitEffectDuration / 1000
                    )
                }
            }
        }

        // 人名贴/校徽/课标
        if (this.playOverlayWares) {
            if (!this.addOverlayGroups(this.overlayGroups, start, end)) {
                prepared = false
            }
        }

        return prepared
    }

    /**
     * 判断 track 是否在时间段之内
     *
     * @param time, 秒
     */
    isTrackInRange(start, end, track) {
        let inpoint = track.getInPoint()
        let outpoint = track.getOutPoint()
        if (inpoint < start && outpoint < start) {
            return false
        }

        if (inpoint > end && outpoint > end) {
            return false
        }
        return true
    }

    /**
     * 判断时间是否在不在时间段之内
     *
     * @param time, 秒
     */
    isTrackOutRange(start, end, track) {
        let inpoint = track.getInPoint()
        let outpoint = track.getOutPoint()
        if (inpoint < start && outpoint < start) {
            return true
        }

        if (inpoint > end && outpoint > end) {
            return true
        }
        return false
    }

    // 检查当前时间的资源有没有加载完成
    isCurrentTimeSourcesReady(start, end) {
        let sources = this.getSourcesBetween(start, end)
        for (let i = 0; i < sources.length; i++) {
            if (sources[i] == null) {
                continue
            }
            if (!sources[i].isLoaded) {
                // console.log("-- source loading [" + start + "," + end +"] not ready: " + sources[i].url);
                return false
            }
        }
        return true
    }

    /**
     * 加载某个时间点资源
     *
     * @param start, 开始时间
     * @param end, 结束时间
     */
    loadSourcesBetween(start, end) {
        let sources = this.getSourcesBetween(start, end)

        for (let i = 0; i < sources.length; i++) {
            let source = sources[i]
            if (source.isLoaded || source.isLoading) {
                continue
            }

            setTimeout(function () {
                source.load()
            }, i * 20)
        }
    }

    checkPlayFailed() {
        window.clipPlayer.playWaitCount -= window.clipPlayer.interval
        if (window.clipPlayer.playWaitCount < -window.clipPlayer.interval) {
            console.error('--- 资源加载失败, 请重新初始化 ClipLayer 重试')
            window.clipPlayer.stop()
            if (window.clipPlayer.options.onFail != null) {
                console.log('>>> OnFail Called')
                window.clipPlayer.options.onFail()
            }
            window.clipPlayer.end()
        }
    }

    playSelf() {
        window.clipPlayer.isDrawing = true
        if (window.clipPlayer.shouldPause && window.clipPlayer.isPlaying) {
            window.clipPlayer.isDrawing = false
            window.clipPlayer.stop()
            return true
        }

        if (window.clipPlayer.needPlayingSeek) {
            window.clipPlayer.currentTime = window.clipPlayer.seekTime
            window.clipPlayer.needPlayingSeek = false
        }

        if (
            window.clipPlayer.playEndTime > -1 &&
            window.clipPlayer.currentTime >= window.clipPlayer.playEndTime
        ) {
            window.clipPlayer.isDrawing = false
            window.clipPlayer.playEndTime = -1

            window.clipPlayer.stop()
            return true
        }

        if (
            window.clipPlayer.currentTime >=
            window.clipPlayer.getTotalDuration()
        ) {
            window.clipPlayer.isDrawing = false
            window.clipPlayer.stop()
            return true
        }

        let status = {}

        if (window.clipPlayer.options.isVideoSourcePrepared != null) {
            let isVideoSourceLoaded =
                window.clipPlayer.options.isVideoSourcePrepared(
                    window.clipPlayer.currentTime,
                    status
                )
            if (!isVideoSourceLoaded) {
                window.clipPlayer.checkPlayFailed()
                return false
            }
        }

        let isLoaded = window.clipPlayer.isCurrentTimeSourcesReady(
            window.clipPlayer.currentTime,
            window.clipPlayer.currentTime + 5000
        )
        if (!isLoaded) {
            window.clipPlayer.checkPlayFailed()
            return false
        }

        if (window.clipPlayer.enableUnprepare) {
            window.clipPlayer.unprepare(
                window.clipPlayer.currentTime -
                    window.clipPlayer.unprepareOffset,
                window.clipPlayer.currentTime +
                    window.clipPlayer.unprepareOffset
            )
        }

        window.clipPlayer.prepare(
            window.clipPlayer.currentTime + 100,
            window.clipPlayer.currentTime + 2000
        )
        let ret = window.clipPlayer.prepare(
            window.clipPlayer.currentTime,
            window.clipPlayer.currentTime + 100
        )
        if (!ret) {
            console.warn(
                '--- current time not prepared : ' +
                    window.clipPlayer.currentTime
            )
            window.clipPlayer.checkPlayFailed()
            return false
        }

        if (!window.clipPlayer.isPlaying) {
            window.clipPlayer.end()
            return false
        }

        // play with segment 需要在轨道准备好时，seek 到指定点播放
        if (window.clipPlayer.needSeek) {
            window.clipPlayer.editor.seek(window.clipPlayer.currentTime / 1000)
            window.clipPlayer.needSeek = false
        }

        let start = Date.now()
        window.clipPlayer.editor.drawSync()

        if (Date.now() - start > 50) {
            console.log(
                '--- draw sync: ' +
                    (Date.now() - start) +
                    ', ' +
                    window.clipPlayer.currentTime +
                    ', ' +
                    window.clipPlayer.editor.editDuration()
            )
        }

        window.clipPlayer.unprepareSources()
        debugger
        if (
            window.clipPlayer.options.onPlay != null &&
            !window.clipPlayer.onPlayCalled
        ) {
            console.log('>>> OnPlay Called')
            window.clipPlayer.options.onPlay()
            window.clipPlayer.onPlayCalled = true
            console.log('play--------------')
        }

        if (window.clipPlayer.options.playCallback != null) {
            // console.log(">>> playCallback Called");
            window.clipPlayer.options.playCallback(
                window.clipPlayer.currentTime,
                status
            )
        }
        // debugger;
        window.clipPlayer.playWaitCount = window.clipPlayer.options.playWaitTime
        window.clipPlayer.currentTime += window.clipPlayer.interval
        window.clipPlayer.isDrawing = false
    }

    unprepareSources() {
        for (let i = 0; i < this.sourcesToUnprepare.length; i++) {
            this.sourcesToUnprepare[i].isLoaded = false
            this.sourcesToUnprepare[i].unload()
        }
        this.sourcesToUnprepare = []
    }

    /**
     * 是否只播放正文
     */
    setOnlyPlayContent() {
        this.onlyPlayContent = true
    }

    /**
     * 设置人名条，课标，校徽是否使用预览图片
     */
    setUsePreviewImage(flag) {
        this.usePreviewImage = flag
    }

    /**
     * 不播放已裁剪的片段
     *
     * @note 在 setJsonData 之前设置
     * 成片整片预览的时候调用该方法
     *
     */
    setDisablePlayDeleteSegment() {
        this.playDeleteSegment = false
    }

    /**
     * 设置是否播放转场
     *
     */
    setPlayTransition(flag) {
        this.playTransition = flag
    }

    /**
     * 设置是否播放美颜效果
     *
     */
    setPlayImageSkin(flag) {
        this.playImageSkin = flag
    }

    /**
     * 设置脚本 json
     *
     * @param json
     */
    setJsonData(json) {
        if (this.isPlaying) {
            console.warn('--- ClipPlayer is playing, skip...')
            return false
        }

        this.init()
        this.clipJson = json
        console.log(this.clipJson, '======')
        this.parser = new ScriptParser(this)
        this.parser.parse()
        return true
    }

    playAudioSelf() {
        if (!window.clipPlayer.isPlaying) {
            window.clipPlayer.audioPlayer.pause()
        }
        window.clipPlayer.editor.readNextAudioBlock()
    }

    playAudio() {
        this.audioPlayer.resume()
        this.playAudioInterval = setInterval(
            window.clipPlayer.playAudioSelf,
            window.clipPlayer.audioPlayer.feedInterval
        )
    }

    /**
     * 是否开启资源缓存释放
     *
     */

    setEnableUnprepare(enable) {
        this.enableUnprepare = enable
    }

    /**
     * 设置播放时间点
     *
     *  @param time, 毫秒
     */
    seek(time) {
        this.seekTime = time
        this.needSeek = true
        this.needPlayingSeek = true
    }

    /**
     * 寻帧，并绘制目标帧
     *
     *
     */
    seekDraw(time) {
        if (this.isPlaying) {
            console.warn('--- ClipPalyer is playing -- draw')
            return
        }
        this.seekTime = time
        this.needSeek = true
        this.draw()
    }

    /**
     * 绘制当前帧
     *
     *
     */
    draw() {
        this.currentTime = this.seekTime
        this.playEndTime = this.currentTime + this.interval
        this.isDraw = true
        this.play()
    }

    /**
     * 开始播放
     *
     * 使用 seek 设置播放时间
     */ debugger

    play() {
        debugger
        if (this.isPlaying) {
            console.warn('--- ClipPlayer already playing')
            return
        }

        if (this.needSeek) {
            this.currentTime = this.seekTime
        }

        if (this.isDraw) {
            this.needPlayAudio = false
        } else {
            this.needPlayAudio = true
        }

        this.isPlaying = true
        this.onPlayCalled = false

        // 加载资源
        this.startSourceLoad()

        // 播放定时器
        if (this.playInterval != null) {
            clearInterval(this.playInterval)
        }

        this.shouldPause = false
        this.playInterval = setInterval(
            window.clipPlayer.playSelf,
            window.clipPlayer.interval
        )

        // 音频播放
        if (this.needPlayAudio) {
            this.playAudio()
        }
        debugger
    }

    end() {
        // window.clipPlayer.playEndTime = -1;
        window.clipPlayer.isPlaying = false
        if (window.clipPlayer.options.onFinished != null) {
            console.log('>>> OnFinished Called')
            window.clipPlayer.options.onFinished()
        }
    }

    stop() {
        console.warn('--- ClipPlayer stop called')
        window.clipPlayer.needPlayAudio = true
        window.clipPlayer.isDraw = false
        window.clipPlayer.playWaitCount = window.clipPlayer.options.playWaitTime
        window.clipPlayer.stopSourceLoad()

        if (window.clipPlayer.playInterval != null) {
            clearInterval(window.clipPlayer.playInterval)
            clearInterval(window.clipPlayer.playAudioInterval)
        }

        console.log(
            '--- ClipPalyer stop() -> isDrawing ' + window.clipPlayer.isDrawing
        )
        window.clipPlayer.shouldPause = false

        if (window.clipPlayer.isDrawing == false) {
            window.clipPlayer.end()
        }
    }

    /**
     * 暂停播放
     *
     *
     */
    pause() {
        // window.clipPlayer.playEndTime = window.clipPlayer.currentTime + window.clipPlayer.interval;
        window.clipPlayer.shouldPause = true
    }

    /**
     * 播放段落
     *
     */
    playWithSegment(segmentId) {
        let group = null
        for (let i = 0; i < this.segmentGroups.length; i++) {
            if (this.segmentGroups[i].segment == null) {
                continue
            }
            if (this.segmentGroups[i].segment == segmentId) {
                group = this.segmentGroups[i]
                break
            }
        }

        if (group == null) {
            console.warn('--- invalid segment id, play failed')
            return
        }

        let startTime = group.getInPoint() + this.interval / 2 + 1
        this.seekTime = startTime
        this.playEndTime = group.getOutPoint()
        console.log(
            '--- play segment : [' +
                this.seekTime +
                ',' +
                this.playEndTime +
                ']'
        )

        this.needSeek = true

        this.play()
        return true
    }

    /**
     * 开始资源加载
     *
     */
    startSourceLoad() {
        // 资源记载定时器
        debugger
        this.loadSourceInterval = setInterval(() => {
            // 检查时间的资源有没有加载完成
            let isLoaded = window.clipPlayer.isCurrentTimeSourcesReady(
                window.clipPlayer.currentTime,
                window.clipPlayer.currentTime +
                    window.clipPlayer.sourcePrepareOffset
            )
            if (!isLoaded) {
                window.clipPlayer.loadSourcesBetween(
                    window.clipPlayer.currentTime,
                    window.clipPlayer.currentTime +
                        window.clipPlayer.sourcePrepareOffset
                )
            }
        }, 100)
    }

    /**
     * 暂停资源加载
     *
     */
    stopSourceLoad() {
        if (this.loadSourceInterval != null) {
            clearInterval(this.loadSourceInterval)
        }
    }

    /**
     * destroy
     *
     */
    destroy() {
        // this.stop();
        this.unprepare(
            this.getTotalDuration() + 100000,
            this.getTotalDuration(),
            true
        )
        this.editor.delete()
        this.unprepareSources()
    }

    /**
     * 清空播放器内所有资源和轨道
     * @note 调用该方法后需要重新使用 setJsonData 初始化数据
     */
    reset() {
        if (this.isPlaying) {
            console.warn('--- ClipPlayer is playing, reset failed')
            return false
        }
        this.stop()
        this.inited = false

        this.unprepare(
            this.getTotalDuration() + 100000,
            this.getTotalDuration() + 1000000,
            true
        )

        this.editor.reset()
        this.editor.drawSync()
        this.unprepareSources()
        this.editor.seek(0)
        this.currentTime = 0
        return true
    }

    /**
     * 获取总时间
     *
     */
    getTotalDuration() {
        let duration = -this.transitionTime
        for (let i = 0; i < this.segmentGroups.length; i++) {
            duration += this.segmentGroups[i].getDisplayTime()
        }
        return duration
    }
}
