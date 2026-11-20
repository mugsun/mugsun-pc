<!-- WangEditor 富文本编辑器 插件地址：https://www.wangeditor.com/ -->
<template>
  <div class="editor-wrapper">
    <Toolbar
      class="editor-toolbar"
      :editor="editorRef"
      :mode="mode"
      :defaultConfig="toolbarConfig"
    />
    <Editor
      :style="{ height: height, overflowY: 'hidden' }"
      v-model="modelValue"
      :mode="mode"
      :defaultConfig="editorConfig"
      @onCreated="onCreateEditor"
    />
  </div>
</template>

<script setup lang="ts">
  import '@wangeditor/editor/dist/css/style.css'
  import { onBeforeUnmount, onMounted, shallowRef, computed } from 'vue'
  import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
  import { useI18n } from 'vue-i18n'
  import { $t } from '@/locales'
  import EmojiText from '@/utils/ui/emojo'
  import { IDomEditor, IToolbarConfig, IEditorConfig } from '@wangeditor/editor'
  import { ElMessage } from 'element-plus'
  import { uploadRichTextImage } from '@/api/attach'
  import {
    EDITOR_IMAGE_ACCEPT,
    createEditorImageUploader,
    editorImageLimit,
    formatEditorImageLimit,
    withoutVideoUpload
  } from './image-upload'

  defineOptions({ name: 'ArtWangEditor' })

  const { t } = useI18n()

  // Props 定义
  interface Props {
    /** 编辑器高度 */
    height?: string
    /** 自定义工具栏配置 */
    toolbarKeys?: string[]
    /** 插入新工具到指定位置 */
    insertKeys?: { index: number; keys: string[] }
    /** 排除的工具栏项 */
    excludeKeys?: string[]
    /** 编辑器模式 */
    mode?: 'default' | 'simple'
    /** 占位符文本 */
    placeholder?: string
    /** 上传配置 */
    uploadConfig?: {
      /** 单张图片上限（字节），默认 5MB；只能调小，后端不收更大的 */
      maxFileSize?: number
    }
  }

  const props = withDefaults(defineProps<Props>(), {
    height: '500px',
    mode: 'default',
    placeholder: $t('components.wangEditor.placeholder'),
    excludeKeys: () => ['fontFamily']
  })

  const modelValue = defineModel<string>({ required: true })

  // 编辑器实例
  const editorRef = shallowRef<IDomEditor>()

  // 上传还没结束编辑器就销毁了（关弹窗、离开页面）时取不到：销毁后再动进度条或插入图片会抛异常
  const liveEditor = () => {
    const editor = editorRef.value
    return editor && !editor.isDestroyed ? editor : undefined
  }

  const imageMaxBytes = editorImageLimit(props.uploadConfig?.maxFileSize)

  // 图片上传：选文件、粘贴、拖拽都走这里。请求失败的提示由请求封装弹出，这里不再重复提示
  const uploadImage = createEditorImageUploader({
    maxBytes: imageMaxBytes,
    // 上传中最多显示到 99，结束时再到 100：进度条到 100 以后编辑器会自己收起
    upload: (file) =>
      uploadRichTextImage(file, (percent) => liveEditor()?.showProgressBar(Math.min(percent, 99))),
    canInsert: () => !!liveEditor(),
    onRejected(reason) {
      const message = {
        type: t('components.wangEditor.imageTypeInvalid'),
        empty: t('components.wangEditor.imageEmpty'),
        size: t('components.wangEditor.imageTooLarge', {
          size: formatEditorImageLimit(imageMaxBytes)
        })
      }[reason]
      ElMessage.warning({ message, grouping: true })
    },
    onInserted() {
      ElMessage.success({
        message: `${t('components.wangEditor.uploadSuccess')} ${EmojiText[200]}`,
        grouping: true
      })
    },
    onMissingUrl() {
      ElMessage.error(`${t('components.wangEditor.uploadFailed')} ${EmojiText[500]}`)
    },
    onSettled: () => liveEditor()?.showProgressBar(100)
  })

  // 工具栏配置
  const toolbarConfig = computed((): Partial<IToolbarConfig> => {
    const config: Partial<IToolbarConfig> = {}

    // 完全自定义工具栏
    if (props.toolbarKeys && props.toolbarKeys.length > 0) {
      config.toolbarKeys = props.toolbarKeys
    }

    // 插入新工具
    if (props.insertKeys) {
      config.insertKeys = props.insertKeys
    }

    // 排除工具：没有视频上传接口，「上传视频」总是去掉（「插入视频」填地址的方式还在）
    config.excludeKeys = withoutVideoUpload(props.excludeKeys)

    return config
  })

  // 编辑器配置
  const editorConfig: Partial<IEditorConfig> = {
    placeholder: props.placeholder,
    MENU_CONF: {
      uploadImage: {
        allowedFileTypes: EDITOR_IMAGE_ACCEPT,
        customUpload: uploadImage
      }
    }
  }

  // 编辑器创建回调
  const onCreateEditor = (editor: IDomEditor) => {
    editorRef.value = editor

    // 监听全屏事件
    editor.on('fullScreen', () => {
      console.log('编辑器进入全屏模式')
    })

    // 确保在编辑器创建后应用自定义图标
    applyCustomIcons()
  }

  // 应用自定义图标（带重试机制）
  const applyCustomIcons = () => {
    let retryCount = 0
    const maxRetries = 10
    const retryDelay = 100

    const tryApplyIcons = () => {
      const editor = editorRef.value
      if (!editor) {
        if (retryCount < maxRetries) {
          retryCount++
          setTimeout(tryApplyIcons, retryDelay)
        }
        return
      }

      // 获取当前编辑器的工具栏容器
      const editorContainer = editor.getEditableContainer().closest('.editor-wrapper')
      if (!editorContainer) {
        if (retryCount < maxRetries) {
          retryCount++
          setTimeout(tryApplyIcons, retryDelay)
        }
        return
      }

      const toolbar = editorContainer.querySelector('.w-e-toolbar')
      const toolbarButtons = editorContainer.querySelectorAll('.w-e-bar-item button[data-menu-key]')

      if (toolbar && toolbarButtons.length > 0) {
        return
      }

      // 如果工具栏还没渲染完成，继续重试
      if (retryCount < maxRetries) {
        retryCount++
        setTimeout(tryApplyIcons, retryDelay)
      } else {
        console.warn('工具栏渲染超时，无法应用自定义图标 - 编辑器实例:', editor.id)
      }
    }

    // 使用 requestAnimationFrame 确保在下一帧执行
    requestAnimationFrame(tryApplyIcons)
  }

  // 暴露编辑器实例和方法
  defineExpose({
    /** 获取编辑器实例 */
    getEditor: () => editorRef.value,
    /** 设置编辑器内容 */
    setHtml: (html: string) => editorRef.value?.setHtml(html),
    /** 获取编辑器内容 */
    getHtml: () => editorRef.value?.getHtml(),
    /** 清空编辑器 */
    clear: () => editorRef.value?.clear(),
    /** 聚焦编辑器 */
    focus: () => editorRef.value?.focus()
  })

  // 生命周期
  onMounted(() => {
    // 图标替换已在 onCreateEditor 中处理
  })

  onBeforeUnmount(() => {
    const editor = editorRef.value
    if (editor) {
      editor.destroy()
    }
  })
</script>

<style lang="scss">
  @use './style';
</style>
