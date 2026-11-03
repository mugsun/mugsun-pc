<!-- 个人中心：头像/昵称/密码维护 + 联系方式展示 + 第三方账号绑定 -->
<template>
  <div class="user-center-page art-full-height">
    <ElAlert
      v-if="needChangePassword"
      type="warning"
      :closable="false"
      show-icon
      class="uc-force-pwd-alert"
      :title="$t('pages.system.userCenter.forceChangeTitle')"
      :description="$t('pages.system.userCenter.forceChangeDesc')"
    />
    <ElRow :gutter="16" class="uc-row" :class="{ 'is-force-pwd': needChangePassword }">
      <ElCol :xs="24" :md="10" class="uc-col-info">
        <ElCard>
          <template #header>{{ $t('pages.system.userCenter.infoTitle') }}</template>
          <div class="uc-avatar-row">
            <img
              v-if="info.avatar"
              :src="resolveAvatarUrl(info.avatar)"
              class="uc-avatar"
              :alt="$t('pages.system.userCenter.avatarAlt')"
            />
            <div v-else class="uc-avatar uc-avatar-fallback">
              {{ (info.nickName || info.userName || '?').slice(0, 1) }}
            </div>
            <ElTooltip
              :disabled="!needChangePassword"
              :content="$t('pages.system.userCenter.forceChangeTitle')"
              placement="top"
            >
              <!-- 强制改密：不挂 Upload，避免 disabled 仍可点开选文件 -->
              <span class="uc-inline-block uc-force-lock-wrap">
                <ElButton
                  v-if="needChangePassword"
                  size="small"
                  disabled
                  aria-disabled="true"
                  class="is-force-locked"
                  >{{ $t('pages.system.userCenter.changeAvatar') }}</ElButton
                >
                <ElUpload
                  v-else
                  :auto-upload="false"
                  :show-file-list="false"
                  accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
                  :on-change="handleAvatarChange"
                >
                  <ElButton size="small" :loading="avatarUploading">{{
                    $t('pages.system.userCenter.changeAvatar')
                  }}</ElButton>
                </ElUpload>
              </span>
            </ElTooltip>
          </div>
          <ElDescriptions :column="1" border>
            <ElDescriptionsItem :label="$t('pages.system.userCenter.labelUsername')">{{
              info.userName
            }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="$t('pages.system.userCenter.labelNickname')">{{
              info.nickName
            }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="$t('pages.system.userCenter.labelEmail')">{{
              info.email || $t('pages.system.userCenter.unbound')
            }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="$t('pages.system.userCenter.labelPhone')">{{
              info.phone || $t('pages.system.userCenter.unbound')
            }}</ElDescriptionsItem>
            <ElDescriptionsItem :label="$t('pages.system.userCenter.labelRoles')">{{
              roleNames
            }}</ElDescriptionsItem>
          </ElDescriptions>
        </ElCard>
      </ElCol>

      <ElCol :xs="24" :md="14" class="uc-col-forms">
        <ElCard class="uc-form-card uc-pwd-card" ref="pwdCardRef">
          <template #header>{{ $t('pages.system.userCenter.editPasswordTitle') }}</template>
          <ElForm ref="pwdRef" :model="pwdForm" :rules="pwdRules" label-width="90px">
            <ElFormItem :label="$t('pages.system.userCenter.oldPassword')" prop="oldPassword">
              <ElInput
                ref="oldPwdInputRef"
                v-model="pwdForm.oldPassword"
                type="password"
                show-password
                style="max-width: 320px"
              />
            </ElFormItem>
            <ElFormItem :label="$t('pages.system.userCenter.newPassword')" prop="newPassword">
              <ElInput
                v-model="pwdForm.newPassword"
                type="password"
                show-password
                style="max-width: 320px"
              />
            </ElFormItem>
            <ElFormItem
              :label="$t('pages.system.userCenter.confirmPassword')"
              prop="confirmPassword"
            >
              <ElInput
                v-model="pwdForm.confirmPassword"
                type="password"
                show-password
                style="max-width: 320px"
              />
            </ElFormItem>
            <ElFormItem>
              <ElButton type="primary" :loading="pwdSaving" @click="savePassword">{{
                $t('pages.system.userCenter.save')
              }}</ElButton>
            </ElFormItem>
          </ElForm>
        </ElCard>

        <ElCard class="uc-form-card uc-nickname-card">
          <template #header>{{ $t('pages.system.userCenter.editNicknameTitle') }}</template>
          <ElForm
            ref="infoRef"
            :model="infoForm"
            :rules="infoRules"
            label-width="90px"
            :disabled="needChangePassword"
          >
            <ElFormItem :label="$t('pages.system.userCenter.labelNickname')" prop="nickname">
              <ElInput
                v-model="infoForm.nickname"
                :placeholder="$t('pages.system.userCenter.nicknamePlaceholder')"
                style="max-width: 320px"
              />
            </ElFormItem>
            <ElFormItem>
              <ElTooltip
                :disabled="!needChangePassword"
                :content="$t('pages.system.userCenter.forceChangeTitle')"
                placement="top"
              >
                <span class="uc-inline-block uc-force-lock-wrap">
                  <ElButton
                    :type="needChangePassword ? 'default' : 'primary'"
                    :loading="infoSaving"
                    :disabled="needChangePassword"
                    :aria-disabled="needChangePassword ? 'true' : undefined"
                    class="uc-nickname-save"
                    :class="{ 'is-force-locked': needChangePassword }"
                    @click="saveInfo"
                    >{{ $t('pages.system.userCenter.save') }}</ElButton
                  >
                </span>
              </ElTooltip>
            </ElFormItem>
          </ElForm>
        </ElCard>

        <!-- 第三方账号：mock 来源仅 dev 且后端允许时可见（门控与登录页对齐，生产绝不出现） -->
        <ElCard class="uc-form-card" v-if="showMockBind && !needChangePassword">
          <template #header>{{ $t('pages.system.userCenter.socialTitle') }}</template>
          <div class="uc-social">
            <span>{{ $t('pages.system.userCenter.mockSocial') }}</span>
            <div>
              <ElButton type="primary" size="small" @click="bindSocial('mock')">{{
                $t('pages.system.userCenter.bind')
              }}</ElButton>
              <ElButton size="small" @click="unbindSocial('mock')">{{
                $t('pages.system.userCenter.unbind')
              }}</ElButton>
            </div>
          </div>
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { resolveAvatarUrl } from '@/utils/avatar'
  import { watch, nextTick, ref, reactive, computed, onMounted } from 'vue'
  import type { FormInstance, FormRules, UploadFile } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'
  import { useSettingStore } from '@/store/modules/setting'
  import { fetchUpdateInfo, fetchUpdatePassword, uploadAvatarFile } from '@/api/system-manage'
  import { fetchSocialRender, fetchSocialUnbind, fetchSocialSources } from '@/api/auth'
  import { fetchRoleCodeSelect } from '@/api/role'
  import { encryptPassword, isGmEncryptError } from '@/utils/gm'
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'UserCenter' })

  const { t } = useI18n()

  const userStore = useUserStore()
  const settingStore = useSettingStore()
  const needChangePassword = computed(() => !!userStore.getUserInfo?.needChangePassword)
  const info = computed<any>(() => userStore.getUserInfo || {})
  const pwdCardRef = ref<any>()
  const oldPwdInputRef = ref<any>()

  /** 强制改密：关掉顶栏新手引导；滚到改密卡并聚焦原密码 */
  const focusForceChangePassword = async (): Promise<void> => {
    if (!needChangePassword.value) return
    settingStore.hideSettingGuide()
    await nextTick()
    // 不 scrollIntoView：390 首屏须同时看见顶部横幅 + 改密表单
    const pageEl = document.querySelector('.user-center-page') as HTMLElement | null
    if (pageEl) pageEl.scrollTop = 0
    window.scrollTo(0, 0)
    await nextTick()
    const input = oldPwdInputRef.value
    // preventScroll：避免聚焦把横幅顶出视口
    const native = (input?.input || input?.$el?.querySelector?.('input')) as
      | HTMLInputElement
      | undefined
    if (native?.focus) native.focus({ preventScroll: true })
    else if (input?.focus) input.focus()
  }

  // 角色码 → 角色名映射：/auth/info 只返回角色码（admin/R_SUPER…），按角色码下拉翻译为中文名；
  // 无角色列表权限时接口被拒，降级原样显示角色码
  const roleNameMap = ref<Record<string, string>>({})
  onMounted(async () => {
    try {
      const options = (await fetchRoleCodeSelect()) || []
      roleNameMap.value = Object.fromEntries(options.map((o: any) => [String(o.value), o.label]))
    } catch {
      roleNameMap.value = {}
    }
    await focusForceChangePassword()
  })

  watch(needChangePassword, (v) => {
    if (v) void focusForceChangePassword()
  })
  // R_SUPER/R_ADMIN 是菜单门控伪角色（非 sys_role 真实角色），不展示；真实角色码翻译为中文名
  const PSEUDO_ROLES = ['R_SUPER', 'R_ADMIN']
  const roleNames = computed(() => {
    const roles: string[] = info.value.roles || []
    const names = roles
      .filter((r) => !PSEUDO_ROLES.includes(r))
      .map((r) => roleNameMap.value[r] || r)
    return names.length ? names.join(', ') : roles.join(', ')
  })

  const infoRef = ref<FormInstance>()
  const infoForm = reactive({ nickname: info.value.nickName || '' })
  const infoSaving = ref(false)
  const infoRules: FormRules = {
    nickname: [
      { required: true, message: t('pages.system.userCenter.nicknameRequired'), trigger: 'blur' }
    ]
  }

  const saveInfo = async (): Promise<void> => {
    if (needChangePassword.value) return
    if (!infoRef.value || infoSaving.value) return
    await infoRef.value.validate(async (valid) => {
      if (!valid) return
      infoSaving.value = true
      try {
        await fetchUpdateInfo({ nickname: infoForm.nickname })
        userStore.setUserInfo({ ...(userStore.getUserInfo as any), nickName: infoForm.nickname })
        ElMessage.success(t('pages.system.userCenter.nicknameSaved'))
      } finally {
        infoSaving.value = false
      }
    })
  }

  // ===== 头像上传：/auth/avatar/upload（后端同时落 sys_user.avatar）=====
  const avatarUploading = ref(false)
  const AVATAR_MAX_SIZE = 2 * 1024 * 1024
  const AVATAR_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  const AVATAR_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp']
  /** MIME 与扩展名须同时命中白名单 */
  const isAllowedAvatar = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    return AVATAR_MIME.includes(file.type) && AVATAR_EXT.includes(ext)
  }

  const handleAvatarChange = async (uploadFile: UploadFile): Promise<void> => {
    if (needChangePassword.value) return
    const raw = uploadFile.raw
    if (!raw) return
    if (!isAllowedAvatar(raw)) {
      ElMessage.warning(t('pages.system.userCenter.avatarTypeInvalid'))
      return
    }
    if (raw.size > AVATAR_MAX_SIZE) {
      ElMessage.warning(t('pages.system.userCenter.avatarTooLarge'))
      return
    }
    try {
      avatarUploading.value = true
      const attach = await uploadAvatarFile(raw)
      if (!attach?.url) {
        ElMessage.error(t('pages.system.userCenter.avatarUploadFailed'))
        return
      }
      // 后端上传成功即已更新本人头像，前端仅同步本地状态
      userStore.setUserInfo({ ...(userStore.getUserInfo as any), avatar: attach.url })
      ElMessage.success(t('pages.system.userCenter.avatarUpdated'))
    } catch (error) {
      // 错误提示（后端 msg）已由 http 层 HttpError + showError 统一弹出，此处仅记录
      console.error('[UserCenter] upload avatar failed:', error)
    } finally {
      avatarUploading.value = false
    }
  }

  const pwdRef = ref<FormInstance>()
  const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const pwdSaving = ref(false)
  const pwdRules: FormRules = {
    oldPassword: [
      { required: true, message: t('pages.system.userCenter.oldPasswordRequired'), trigger: 'blur' }
    ],
    newPassword: [
      { required: true, message: t('pages.system.userCenter.passwordRule'), trigger: 'blur' },
      {
        validator: (_r: unknown, v: string, cb: (e?: Error) => void) => {
          const kinds =
            Number(/[a-z]/.test(v)) +
            Number(/[A-Z]/.test(v)) +
            Number(/\d/.test(v)) +
            Number(/[^a-zA-Z0-9]/.test(v))
          if (!v || v.length < 8 || kinds < 3)
            cb(new Error(t('pages.system.userCenter.passwordRule')))
          else cb()
        },
        trigger: 'blur'
      }
    ],
    confirmPassword: [
      {
        validator: (_r: any, v: string, cb: any) =>
          v === pwdForm.newPassword
            ? cb()
            : cb(new Error(t('pages.system.userCenter.passwordMismatch'))),
        trigger: 'blur'
      }
    ]
  }

  const savePassword = async (): Promise<void> => {
    if (!pwdRef.value || pwdSaving.value) return
    await pwdRef.value.validate(async (valid) => {
      if (!valid) return
      pwdSaving.value = true
      try {
        await fetchUpdatePassword({
          oldPassword: await encryptPassword(pwdForm.oldPassword),
          newPassword: await encryptPassword(pwdForm.newPassword)
        })
        ElMessage.success(t('pages.system.userCenter.passwordSaved'))
        pwdForm.oldPassword = ''
        pwdForm.newPassword = ''
        pwdForm.confirmPassword = ''
        // 清强制改密标记；后端改密即全端下线，前端同步清理并回登录页
        if (userStore.getUserInfo?.needChangePassword) {
          userStore.setUserInfo({
            ...userStore.getUserInfo,
            needChangePassword: false
          } as Api.Auth.UserInfo)
        }
        setTimeout(() => {
          userStore.logOut()
        }, 800)
      } catch (error) {
        if (isGmEncryptError(error)) {
          ElMessage.error(t('pages.auth.login.gmEncryptFailed'))
        }
      } finally {
        pwdSaving.value = false
      }
    })
  }

  // ===== 第三方账号：mock 绑定区门控与登录页对齐（DEV 且后端允许 mock） =====
  const showMockBind = ref(false)
  onMounted(async () => {
    if (!import.meta.env.DEV) return
    try {
      const data = await fetchSocialSources()
      showMockBind.value = !!data.mockEnabled
    } catch {
      showMockBind.value = false
    }
  })

  // 绑定第三方账号：取授权地址并跳转，回调页检测到已登录态即执行绑定
  const bindSocial = async (source: string) => {
    try {
      const { authorizeUrl } = await fetchSocialRender(source)
      window.location.href = authorizeUrl
    } catch (e: any) {
      ElMessage.error(e?.message || t('pages.system.userCenter.bindFailed'))
    }
  }

  const unbindSocial = async (source: string) => {
    await fetchSocialUnbind(source)
    ElMessage.success(t('pages.system.userCenter.unbindSuccess'))
  }
</script>

<style scoped>
  /* 个人信息 + 三张表单卡为自由增长内容：art-full-height 定高下页面须自备纵向滚动，
     否则矮视口下修改密码卡底部被视口切断且无法到达（同 track/funnel 修法） */
  .user-center-page {
    overflow-y: auto;
  }

  .user-center-page > .el-row {
    flex-shrink: 0;
  }

  .uc-form-card {
    margin-bottom: 16px;
  }

  .uc-avatar-row {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .uc-avatar {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border: 1px solid var(--default-border);
    border-radius: 50%;
  }

  .uc-avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #fff;
    user-select: none;
    background: var(--theme-color);
  }

  .uc-force-pwd-alert {
    margin-bottom: 16px;
  }

  .uc-force-pwd-alert :deep(.el-alert__title),
  .uc-force-pwd-alert :deep(.el-alert__description) {
    color: #b45309;
  }

  .uc-inline-block {
    display: inline-block;
  }

  /* 强制改密：禁用态必须一眼灰、不可点（含 primary） */
  .uc-force-lock-wrap :deep(.el-button.is-disabled),
  .uc-force-lock-wrap :deep(.el-button.is-force-locked),
  .is-force-locked.el-button.is-disabled {
    color: #a8abb2 !important;
    pointer-events: none;
    cursor: not-allowed !important;
    background-color: #f5f7fa !important;
    border-color: #e4e7ed !important;
    box-shadow: none !important;
    opacity: 1;
  }

  .uc-force-lock-wrap {
    cursor: not-allowed;
  }

  /* 强制改密 + ≤767：改密卡排到个人信息上面（display:contents 拆开 forms 列） */
  @media (width <= 767px) {
    .uc-row.is-force-pwd {
      display: flex;
      flex-direction: column;
    }

    .uc-row.is-force-pwd .uc-col-forms {
      display: contents;
    }

    .uc-row.is-force-pwd .uc-pwd-card {
      order: 1;
    }

    .uc-row.is-force-pwd .uc-col-info {
      order: 2;
    }

    .uc-row.is-force-pwd .uc-nickname-card {
      order: 3;
    }
  }
</style>
