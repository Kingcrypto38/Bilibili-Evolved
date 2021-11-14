import { ComponentSettings, componentToSettings } from '@/core/settings'
import { getBuiltInComponents } from './built-in-components'
import {
  ComponentMetadata, componentsMap,
} from './component'

/**
 * 安装自定义组件
 * @param code 组件代码
 */
export const installComponent = async (code: string) => {
  const { components } = await import('./component')
  const { parseExternalInput } = await import('../core/external-input')
  const component = await parseExternalInput<ComponentMetadata>(code)
  if (component === null) {
    throw new Error('无效的组件代码')
  }
  const { settings } = await import('@/core/settings')
  const isBuiltInComponent = getBuiltInComponents().some(it => it.name === component.name)
  if (isBuiltInComponent) {
    throw new Error(`不能覆盖内置组件'${component.name}', 请更换名称`)
  }
  const userMetadata = {
    ...lodash.omit(
      component,
      'entry',
      'widget',
      'instantStyles',
      'reload',
      'unload',
      'plugin',
      'urlInclude',
      'urlExclude',
    ),
  }
  const existingComponent = settings.userComponents[component.name]
  if (existingComponent) {
    existingComponent.code = code
    existingComponent.metadata = userMetadata
    const existingOptions = existingComponent.settings.options
    const newSettings: ComponentSettings = lodash.defaultsDeep(
      existingComponent.settings,
      componentToSettings(component),
    )
    Object.entries(existingOptions).forEach(([name, option]) => {
      if (Array.isArray(option)) {
        newSettings.options[name] = option
      }
    })
    return {
      metadata: component,
      message: `已更新组件'${component.displayName}', 刷新后生效`,
    }
  }
  settings.userComponents[component.name] = {
    code,
    metadata: userMetadata,
    settings: componentToSettings(component),
  }
  components.push(component)
  componentsMap[component.name] = component
  return {
    metadata: component,
    message: `已安装组件'${component.displayName}', 刷新后生效`,
  }
}

/**
 * 卸载自定义组件
 * @param nameOrDisplayName 组件的名称(`name`或`displayName`)
 */
export const uninstallComponent = async (nameOrDisplayName: string) => {
  const { settings } = await import('@/core/settings')
  const { components } = await import('./component')
  const existingComponent = Object.entries(settings.userComponents)
    .find(([name, { metadata: { displayName } }]) => {
      if (name === nameOrDisplayName || displayName === nameOrDisplayName) {
        return true
      }
      return false
    })
  if (!existingComponent) {
    throw new Error(`没有找到与名称'${nameOrDisplayName}'相关联的组件`)
  }
  const [name, { metadata, settings: componentSettings }] = existingComponent
  // 如果已加载
  const index = components.findIndex(it => it.name === name)
  if (index !== -1) {
    // 移除可能的 instantStyles
    const { instantStyles } = components[index]
    if (instantStyles) {
      const { removeStyle } = await import('@/core/style')
      instantStyles.forEach(s => removeStyle(s.name))
    }
    // 移除可能的 widgets
    componentSettings.enabled = false
    components.splice(index, 1)
    delete componentsMap[name]
  }
  delete settings.userComponents[name]
  return {
    metadata,
    message: `已卸载组件'${metadata.displayName}, 刷新后生效'`,
  }
}

/**
 * 切换自定义组件的开关状态
 * @param nameOrDisplayName 组件的名称(`name`或`displayName`)
 */
export const toggleComponent = async (nameOrDisplayName: string) => {
  const { settings } = await import('@/core/settings')
  const existingComponent = Object.entries(settings.userComponents)
    .find(([name, { metadata: { displayName } }]) => {
      if (name === nameOrDisplayName || displayName === nameOrDisplayName) {
        return true
      }
      return false
    })
  if (!existingComponent) {
    throw new Error(`没有找到与名称'${nameOrDisplayName}'相关联的组件`)
  }
  const [, userComponent] = existingComponent
  userComponent.settings.enabled = !userComponent.settings.enabled
  const { enabled } = userComponent.settings
  const { displayName } = userComponent.metadata
  return `已${enabled ? '开启' : '关闭'}组件'${displayName}', 可能需要刷新后才能生效`
}
