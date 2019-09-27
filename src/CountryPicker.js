// @flow
/* eslint import/newline-after-import: 0 */

import React, { Component } from 'react'
import PropTypes from 'prop-types'

import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Modal,
  Text,
  TextInput,
  FlatList,
  SafeAreaView,
  ScrollView,
  Platform
} from 'react-native'

import Fuse from 'fuse.js'

import cca2List from '../data/cca2'
import { getHeightPercent } from './ratio'
import CloseButton from './CloseButton'
import countryPickerStyles from './CountryPicker.style'
import KeyboardAvoidingView from './KeyboardAvoidingView'

let countries = null
let Emoji = null
let styles = {}

let isEmojiable = false // Platform.OS === 'ios'

const FLAG_TYPES = {
  flat: 'flat',
  emoji: 'emoji'
}

const setCountries = flagType => {
  if (typeof flagType !== 'undefined') {
    isEmojiable = flagType === FLAG_TYPES.emoji
  }

  if (isEmojiable) {
    countries = require('../data/countries-emoji')
    Emoji = require('./emoji').default
  } else {
    countries = require('../data/countries')
    Emoji = <View />
  }
}

setCountries()

export const getAllCountries = () =>
  cca2List.map(cca2 => ({ ...countries[cca2], cca2 }))

export default class CountryPicker extends Component {
  static propTypes = {
    cca2: PropTypes.string.isRequired,
    translation: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    onClose: PropTypes.func,
    closeable: PropTypes.bool,
    filterable: PropTypes.bool,
    children: PropTypes.node,
    countryList: PropTypes.array,
    disabledCountries: PropTypes.array,
    styles: PropTypes.object,
    filterPlaceholder: PropTypes.string,
    autoFocusFilter: PropTypes.bool,
    // to provide a functionality to disable/enable the onPress of Country Picker.
    disabled: PropTypes.bool,
    filterPlaceholderTextColor: PropTypes.string,
    closeButtonImage: PropTypes.element,
    transparent: PropTypes.bool,
    animationType: PropTypes.oneOf(['slide', 'fade', 'none']),
    flagType: PropTypes.oneOf(Object.values(FLAG_TYPES)),
    hideAlphabetFilter: PropTypes.bool,
    renderFilter: PropTypes.func,
    showCallingCode: PropTypes.bool,
    filterOptions: PropTypes.object
  }

  static defaultProps = {
    translation: 'eng',
    countryList: cca2List,
    disabledCountries: [],
    filterPlaceholder: 'Filter',
    autoFocusFilter: true,
    transparent: false,
    animationType: 'none'
  }

  static renderEmojiFlag(cca2, emojiStyle) {
    return (
      <Text style={[countryPickerStyles.emojiFlag, emojiStyle]} allowFontScaling={false}>
        {cca2 !== '' && countries[cca2.toUpperCase()] ? (
          <Emoji name={countries[cca2.toUpperCase()].flag} />
        ) : null}
      </Text>
    )
  }

  static renderImageFlag(cca2, imageStyle) {
    return cca2 !== '' ? (
      <Image
        style={[countryPickerStyles.imgStyle, imageStyle]}
        source={{ uri: countries[cca2].flag }}
      />
    ) : null
  }

  static renderFlag(cca2, itemStyle, emojiStyle, imageStyle) {
    return (
      <View style={[countryPickerStyles.itemCountryFlag, itemStyle]}>
        {isEmojiable
          ? CountryPicker.renderEmojiFlag(cca2, emojiStyle)
          : CountryPicker.renderImageFlag(cca2, imageStyle)}
      </View>
    )
  }

  constructor(props) {
    super(props)
    this.openModal = this.openModal.bind(this)

    setCountries(props.flagType)
    let countryList = [...props.countryList]
    const disabledCountries = [...props.disabledCountries]
    this.disabledCountriesByCode = {};
    disabledCountries.forEach(c => {
      this.disabledCountriesByCode[c] = true;
    });

    // Sort country list
    countryList = countryList
      .map(c => [c, this.getCountryName(countries[c])])
      .sort((a, b) => {
        if (a[1] < b[1]) return -1
        if (a[1] > b[1]) return 1
        return 0
      })
      .map(c => c[0])

    this.state = {
      modalVisible: false,
      cca2List: countryList,
      filter: '',
      cca2ListFiltered: null,
      letters: this.getLetters(countryList)
    }

    if (this.props.styles) {
      Object.keys(countryPickerStyles).forEach(key => {
        styles[key] = StyleSheet.flatten([
          countryPickerStyles[key],
          this.props.styles[key]
        ])
      })
      styles = StyleSheet.create(styles)
    } else {
      styles = countryPickerStyles
    }

    const options = Object.assign({
      shouldSort: true,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
      keys: ['name'],
      id: 'id'
    }, this.props.filterOptions);
    this.fuse = new Fuse(
      countryList.reduce(
        (acc, item) => [
          ...acc,
          { id: item, name: this.getCountryName(countries[item]) }
        ],
        []
      ),
      options
    )
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.countryList !== this.props.countryList) {
      this.setState({
        cca2List: nextProps.countryList,
      })
    }
  }

  onSelectCountry(cca2) {
    this.setState({
      modalVisible: false,
      filter: '',
      cca2ListFiltered: null,
    })

    this.props.onChange({
      cca2,
      ...countries[cca2],
      flag: undefined,
      name: this.getCountryName(countries[cca2])
    })
  }

  onClose = () => {
    this.setState({
      modalVisible: false,
      filter: '',
      cca2ListFiltered: null,
    })
    if (this.props.onClose) {
      this.props.onClose()
    }
  }

  getCountryName(country, optionalTranslation) {
    const translation = optionalTranslation || this.props.translation || 'eng'
    return country.name[translation] || country.name.common
  }

  setVisibleListHeight(offset) {
    this.visibleListHeight = getHeightPercent(100) - offset
  }

  getLetters(list) {
    return Object.keys(
      list.reduce(
        (acc, val) => ({
          ...acc,
          [this.getCountryName(countries[val])
            .slice(0, 1)
            .toUpperCase()]: ''
        }),
        {}
      )
    ).sort()
  }

  openModal = this.openModal.bind(this)

  // dimensions of country list and window
  itemHeight = getHeightPercent(7)
  listHeight = countries.length * this.itemHeight

  openModal() {
    this.setState({ modalVisible: true })
  }

  scrollTo(letter) {
    // find position of first country that starts with letter
    const index = this.state.cca2List
      .map(country => this.getCountryName(countries[country])[0])
      .indexOf(letter)
    if (index === -1) {
      return
    }
    let position = index * this.itemHeight

    // do not scroll past the end of the list
    if (position + this.visibleListHeight > this.listHeight) {
      position = this.listHeight - this.visibleListHeight
    }

    // scroll
    this.flatList.scrollToOffset({
      offset: position
    })
  }

  handleFilterChange = value => {
    const filteredCountries =
      value === '' ? null : this.fuse.search(value)

    this.flatList.scrollToOffset({ offset: 0 })

    this.setState({
      filter: value,
      cca2ListFiltered: filteredCountries,
    })
  }

  renderCountry = ({item}) => {
    const country = item;
    return (
      <TouchableOpacity
        key={country}
        onPress={() => this.onSelectCountry(country)}
      >
        {this.renderCountryDetail(country)}
      </TouchableOpacity>
    )
  }

  renderLetters(letter, index) {
    return (
      <TouchableOpacity
        key={index}
        onPress={() => this.scrollTo(letter)}
        activeOpacity={0.6}
      >
        <View style={styles.letter}>
          <Text style={styles.letterText} allowFontScaling={false}>
            {letter}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  renderCountryDetail(cca2) {
    const country = countries[cca2]
    const isCountryDisabled = this.disabledCountriesByCode[cca2];
    const textStyle = isCountryDisabled ? styles.disabledCountryName : styles.countryName;
    const disabledCountryText = isCountryDisabled ? `. ${this.props.disabledCountryText}` : '';
    return (
      <View style={styles.itemCountry}>
        {CountryPicker.renderFlag(cca2)}
        <View style={styles.itemCountryName}>
          <Text style={textStyle} allowFontScaling={false}>
            {this.getCountryName(country)}
            {this.props.showCallingCode &&
            country.callingCode &&
            <Text>{` (+${country.callingCode})`}</Text>}
            {disabledCountryText}
          </Text>
        </View>
      </View>
    )
  }

  renderFilter = () => {
    const {
      renderFilter,
      autoFocusFilter,
      filterPlaceholder,
      filterPlaceholderTextColor
    } = this.props

    const value = this.state.filter
    const onChange = this.handleFilterChange
    const onClose = this.onClose

    return renderFilter ? (
      renderFilter({ value, onChange, onClose })
    ) : (
      <TextInput
        autoFocus={autoFocusFilter}
        autoCorrect={false}
        placeholder={filterPlaceholder}
        placeholderTextColor={filterPlaceholderTextColor}
        style={[styles.input, !this.props.closeable && styles.inputOnly]}
        onChangeText={onChange}
        value={value}
      />
    )
  }

  onRef = (ref) => {
      this.flatList = ref;
  }

  render() {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          disabled={this.props.disabled}
          onPress={() => this.setState({ modalVisible: true })}
          activeOpacity={0.7}
        >
          {this.props.children ? (
            this.props.children
          ) : (
            <View
              style={[styles.touchFlag, { marginTop: isEmojiable ? 0 : 5 }]}
            >
              {CountryPicker.renderFlag(this.props.cca2,
                styles.itemCountryFlag,
                styles.emojiFlag,
                styles.imgStyle)}
            </View>
          )}
        </TouchableOpacity>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            {this.props.closeable && (
              <CloseButton
                image={this.props.closeButtonImage}
                styles={[styles.closeButton, styles.closeButtonImage]}
                onPress={() => this.onClose()}
              />
            )}
            {this.props.filterable && this.renderFilter()}
          </View>
          <KeyboardAvoidingView behavior="padding">
            <View style={styles.contentContainer}>
              <FlatList
                keyboardShouldPersistTaps="always"
                ref={this.onRef}
                data={this.state.cca2ListFiltered || this.state.cca2List}
                renderItem={this.renderCountry}
                initialNumToRender={30}
                onLayout={({ nativeEvent: { layout: { y: offset } } }) =>
                  this.setVisibleListHeight(offset)
                }
              />
              {!this.props.hideAlphabetFilter && (
                <ScrollView
                  contentContainerStyle={styles.letters}
                  keyboardShouldPersistTaps="always"
                >
                  {this.state.filter === '' &&
                  this.state.letters.map((letter, index) =>
                    this.renderLetters(letter, index)
                  )}
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    )
  }
}
