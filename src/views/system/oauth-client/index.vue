<!-- OAuth2 客户端管理（开放平台，对接 /system/oauth-client） -->
<template>
  <div class="oauth-client-page art-full-height">
    <ElCard class="art-table-card">
      <!-- 卡片体为定高裁剪（全局 overflow:hidden），内容须自备内部滚动，防矮视口裁切 -->
      <div class="oauth-body-scroll">
        <div class="oauth-toolbar">
          <ElButton v-perm="'sys:oauth:manage'" type="primary" @click="showCreate">{{
            $t('pages.system.oauthClient.create')
          }}</ElButton>
        </div>

        <ElTable :data="tableData" border v-loading="loading">
          <ElTableColumn type="index" :label="$t('table.column.index')" width="55" />
          <ElTableColumn
            prop="name"
            :label="$t('pages.system.oauthClient.name')"
            min-width="110"
            show-overflow-tooltip
          />
          <ElTableColumn prop="clientId" label="ClientId" min-width="150" show-overflow-tooltip />
          <ElTableColumn
            prop="clientSecret"
            label="ClientSecret"
            min-width="120"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.oauthClient.grantTypes')" min-width="150">
            <template #default="{ row }">
              <!-- 多授权类型时允许折行，避免被右侧固定操作列横切半截标签 -->
              <div class="oauth-grant-tags">
                <ElTag
                  v-for="g in (row.grantTypes || '').split(',').filter(Boolean)"
                  :key="g"
                  size="small"
                  class="oauth-tag"
                >
                  {{ grantLabel(g) }}
                </ElTag>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="scopes"
            :label="$t('pages.system.oauthClient.scopes')"
            min-width="90"
            show-overflow-tooltip
          />
          <ElTableColumn
            :label="$t('pages.system.oauthClient.validity')"
            width="96"
            prop="accessTokenValidity"
          />
          <ElTableColumn :label="$t('pages.system.oauthClient.status')" width="72">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1
                    ? $t('pages.system.oauthClient.enabled')
                    : $t('pages.system.oauthClient.disabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <!-- 操作已收窄为「编辑 + 更多」；不再 fixed，避免窄视口下遮挡授权范围/状态半截字 -->
          <ElTableColumn :label="$t('pages.system.oauthClient.actions')" width="128">
            <template #default="{ row }">
              <ElButton v-perm="'sys:oauth:manage'" link type="primary" @click="showEdit(row)">{{
                $t('pages.system.oauthClient.edit')
              }}</ElButton>
              <ElDropdown
                v-perm="'sys:oauth:manage'"
                trigger="click"
                class="oauth-more"
                @command="(c: string) => onMoreCommand(c, row)"
              >
                <ElButton link type="info">
                  {{ $t('pages.system.oauthClient.more') }}
                  <ElIcon class="oauth-more-icon"><ArrowDown /></ElIcon>
                </ElButton>
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem command="resetSecret">{{
                      $t('pages.system.oauthClient.resetSecret')
                    }}</ElDropdownItem>
                    <ElDropdownItem command="toggle">
                      {{
                        row.status === 1
                          ? $t('pages.system.oauthClient.disabled')
                          : $t('pages.system.oauthClient.enabled')
                      }}
                    </ElDropdownItem>
                    <ElDropdownItem command="remove" divided>{{
                      $t('pages.system.oauthClient.delete')
                    }}</ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </template>
          </ElTableColumn>
        </ElTable>

        <div class="oauth-pager">
          <ElPagination
            layout="total, prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="pageNum"
            @current-change="onPage"
          />
        </div>
      </div>
    </ElCard>

    <!-- 新建/编辑 -->
    <ElDialog
      v-model="dialogVisible"
      :title="
        form.id ? $t('pages.system.oauthClient.editTitle') : $t('pages.system.oauthClient.create')
      "
      width="560px"
      align-center
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.oauthClient.name')" prop="name">
          <ElInput
            v-model="form.name"
            :placeholder="$t('pages.system.oauthClient.namePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.oauthClient.grantTypes')" prop="grantTypes">
          <ElCheckboxGroup v-model="grantList">
            <ElCheckbox value="client_credentials">{{
              $t('pages.system.oauthClient.grantClientCredentials')
            }}</ElCheckbox>
            <ElCheckbox value="authorization_code">{{
              $t('pages.system.oauthClient.grantAuthorizationCode')
            }}</ElCheckbox>
          </ElCheckboxGroup>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.oauthClient.scopes')">
          <ElSelect
            v-model="scopeList"
            multiple
            filterable
            allow-create
            :placeholder="$t('pages.system.oauthClient.scopePlaceholder')"
          >
            <ElOption v-for="s in scopeOptions" :key="s" :label="s" :value="s" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.oauthClient.redirectUri')">
          <ElInput
            v-model="form.redirectUri"
            :placeholder="$t('pages.system.oauthClient.redirectUriPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.oauthClient.validityLabel')">
          <ElInputNumber v-model="form.accessTokenValidity" :min="60" :step="60" />
          <span class="oauth-hint">{{ $t('pages.system.oauthClient.secondUnit') }}</span>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.oauthClient.remarkPlaceholder')">
          <ElInput
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('pages.system.oauthClient.remarkPlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">{{
          $t('pages.system.oauthClient.save')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 密钥结果（仅此一次） -->
    <ElDialog
      v-model="resultVisible"
      :title="$t('pages.system.oauthClient.secretTitle')"
      width="600px"
      align-center
    >
      <ElAlert type="warning" :closable="false" :title="$t('pages.system.oauthClient.secretTip')" />
      <ElDescriptions :column="1" border class="oauth-result">
        <ElDescriptionsItem label="ClientId">{{ generated.clientId }}</ElDescriptionsItem>
        <ElDescriptionsItem label="ClientSecret">{{ generated.clientSecret }}</ElDescriptionsItem>
      </ElDescriptions>
      <template #footer>
        <ElButton type="primary" @click="resultVisible = false">{{
          $t('pages.system.oauthClient.saved')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { ArrowDown } from '@element-plus/icons-vue'
  import {
    fetchOauthClientPage,
    fetchSaveOauthClient,
    fetchResetOauthSecret,
    fetchEnableOauthClient,
    fetchDisableOauthClient,
    fetchRemoveOauthClient
  } from '@/api/oauth'

  defineOptions({ name: 'OauthClient' })

  const { t } = useI18n()

  const scopeOptions = ['user:read', 'user:write']
  const tableData = ref<any[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const total = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const dialogVisible = ref(false)
  const resultVisible = ref(false)
  const generated = ref<Record<string, any>>({})
  const formRef = ref<FormInstance>()

  const form = reactive<Record<string, any>>({
    id: null,
    name: '',
    grantTypes: '',
    scopes: '',
    redirectUri: '',
    accessTokenValidity: 7200,
    remark: ''
  })
  const grantList = ref<string[]>([])
  const scopeList = ref<string[]>([])

  const rules: FormRules = {
    name: [
      { required: true, message: t('pages.system.oauthClient.namePlaceholder'), trigger: 'blur' }
    ],
    grantTypes: [
      {
        validator: (_r, _v, cb) =>
          grantList.value.length
            ? cb()
            : cb(new Error(t('pages.system.oauthClient.grantRequired'))),
        trigger: 'change'
      }
    ]
  }

  const grantLabel = (g: string): string =>
    g === 'client_credentials'
      ? t('pages.system.oauthClient.grantClientCredentials')
      : g === 'authorization_code'
        ? t('pages.system.oauthClient.grantAuthorizationCode')
        : g

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const resp = await fetchOauthClientPage({ pageNum: pageNum.value, pageSize: pageSize.value })
      tableData.value = resp?.records ?? []
      total.value = resp?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }

  const onPage = (p: number): void => {
    pageNum.value = p
    loadData()
  }

  onMounted(loadData)

  const resetForm = (): void => {
    Object.assign(form, {
      id: null,
      name: '',
      grantTypes: '',
      scopes: '',
      redirectUri: '',
      accessTokenValidity: 7200,
      remark: ''
    })
    grantList.value = ['client_credentials']
    scopeList.value = ['user:read']
  }

  const showCreate = (): void => {
    resetForm()
    dialogVisible.value = true
  }

  const showEdit = (row: any): void => {
    Object.assign(form, {
      id: row.id,
      name: row.name,
      redirectUri: row.redirectUri,
      accessTokenValidity: row.accessTokenValidity ?? 7200,
      remark: row.remark
    })
    grantList.value = (row.grantTypes || '').split(',').filter(Boolean)
    scopeList.value = (row.scopes || '').split(',').filter(Boolean)
    dialogVisible.value = true
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value) return
    form.grantTypes = grantList.value.join(',')
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      submitting.value = true
      try {
        const payload = {
          ...form,
          grantTypes: grantList.value.join(','),
          scopes: scopeList.value.join(',')
        }
        const saved = (await fetchSaveOauthClient(payload)) || {}
        dialogVisible.value = false
        // 新建返回明文密钥
        if (!form.id && saved.clientSecret && !saved.clientSecret.includes('*')) {
          generated.value = saved
          resultVisible.value = true
        } else {
          ElMessage.success(t('pages.system.oauthClient.msgSaved'))
        }
        loadData()
      } finally {
        submitting.value = false
      }
    })
  }

  const resetSecret = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.oauthClient.confirmReset', { name: row.name }),
      t('pages.system.oauthClient.resetSecret'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      generated.value = (await fetchResetOauthSecret(row.id)) || {}
      resultVisible.value = true
      loadData()
    })
  }

  const toggle = (row: any): void => {
    // 停用会使该客户端令牌立即失效，需二次确认；启用无风险直接执行
    if (row.status === 1) {
      ElMessageBox.confirm(
        t('pages.system.oauthClient.confirmDisable', { name: row.name }),
        t('pages.system.oauthClient.disableTitle'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          type: 'warning'
        }
      ).then(async () => {
        await fetchDisableOauthClient(row.id)
        ElMessage.success(t('pages.system.oauthClient.msgDisabled'))
        loadData()
      })
    } else {
      fetchEnableOauthClient(row.id).then(() => {
        ElMessage.success(t('pages.system.oauthClient.msgEnabled'))
        loadData()
      })
    }
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.oauthClient.confirmDelete', { name: row.name }),
      t('pages.system.oauthClient.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveOauthClient(row.id)
      ElMessage.success(t('pages.system.oauthClient.msgDeleted'))
      loadData()
    })
  }

  const onMoreCommand = (command: string, row: any): void => {
    if (command === 'resetSecret') resetSecret(row)
    else if (command === 'toggle') toggle(row)
    else if (command === 'remove') remove(row)
  }
</script>

<style scoped>
  /* 卡片体为定高裁剪（全局 overflow:hidden），内容须自备内部滚动，防矮视口裁切 */
  .oauth-body-scroll {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
  }

  .oauth-toolbar {
    margin-bottom: 12px;
  }

  .oauth-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .oauth-tag {
    margin-right: 6px;
    margin-bottom: 2px;
  }

  .oauth-grant-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 0;
    align-items: center;
    line-height: 1.6;
  }

  .oauth-more {
    margin-left: 4px;
    vertical-align: middle;
  }

  .oauth-more-icon {
    margin-left: 2px;
  }

  .oauth-result {
    margin-top: 14px;

    /* 密钥为无空格长串，允许折行防撑破弹窗 */
    :deep(.el-descriptions__content) {
      word-break: break-all;
    }
  }

  .oauth-hint {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
  }
</style>
